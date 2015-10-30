#!/bin/bash
#
# bbbrssh
# Author: Davis Gilton
# Date: August 14, 2014
#
#
# Verify the correct number of arguments are present.
#
if [ $# -ne 1 ] ; then
	echo "Syntax: bbbrssh <PORT_NUMBER>"
	exit 1
fi

#
# Save some information about this script, including the command
# line arguments.
#
SCRIPT_NAME=$0;
SCRIPTVERSION="v2.1"
ARGS=$@;
PORT_NUMBER=$1;

#
# This script must be executed by the root user.  Restart it if it isn't.
#
if [ $(id -u) != 0 ]; then
	exec /bin/bash -c "/bin/echo zharptica | /usr/bin/sudo -S ${SCRIPT_NAME} $ARGS"
fi
#
# RSSH_SERVER_ADDR -- The IP Address to use for the SSH tunnel connection.
#
RSSH_SERVER_ADDR=rssh.energo.us
#RSSH_SERVER_ADDR=54.191.76.23

#
# Kill any other ssh clients.
#
SSH_PIDS=$(ps -ef | grep "/usr/bin/ssh " | grep -v grep | awk '{print $2}') 2>/dev/null
if [ ! -z "${SSH_PIDS}" ]; then
	/bin/kill -9 ${SSH_PIDS}
fi

#
# Try getting an available port up to 100 times.  The port
# will be a random number between 18000 and 18099.  It's a
# timeout error (exit code 2) if this doesn't work out.
#
SECONDS_ELAPSED=0
while : ; do
	#
	# Exit with "timeout" error if 100 or more tries
	#
	if [ $COUNT > 100 ] ; then
		exit 2
	fi
	#
	# Attempt to tunnel from localhost 22 to {PORTNUMBER} on the RSSH server
	#
	/usr/bin/ssh -N -R ${PORT_NUMBER}:localhost:22 -i /home/ubuntu/.ssh/wup-dev.pem -o 'UserKnownHostsFile=/dev/null' \
		-o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes ubuntu@${RSSH_SERVER_ADDR}  2>&1 > /dev/null &
	#
	# Save the PID -- it gets used to make sure the tunnel is up and running.
	RSSH_PID=$!
	#
	# Try to establish the connection to ${PORTNUMBER} for up to 60 total
	# seconds.
	#
	COUNT2=0
	sleep 20
	while : ; do
		#
		# Look for the tunnel connection to the RSSH server.
		#
		if netstat -p | grep -q "ESTABLISHED[[:blank:]]*${RSSH_PID}\/ssh" ; then
			#
			# The current port worked out, so exit with success
			#
			exit 0
		else
			#
			# The tunnel is given time to either succeed, or fail.  If the
			# ssh process (RSSH_PID) hasn't created an established connection,
			# per the test above, or the process has died, give up.
			#
			if ! ps axo pid | grep -v grep | grep -q $RSSH_PID  ; then
				break
			fi
			#
			# Increment the counter and bottom test so the correct
			# exit code is provided.
			#
			COUNT2=$(( COUNT2 + 1 ))
			if [ $COUNT2 -ge 40 ] ; then
				exit 2;
			fi
			sleep 1
		fi
	done
	COUNT=$(( COUNT + 1 ))

done
#########################################################################################

exit 0
