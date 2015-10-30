#!/bin/bash 
# This script must be executed by root.  Restart it if not.
# v.1.1
SCRIPT_NAME=$0;
ARGS=$@;
if [ $(id -u) != 0 ]; then
        exec /bin/bash -c "/bin/echo zharptica | /usr/bin/sudo -S ${SCRIPT_NAME} $ARGS"
fi
echo {
echo "   "\"txSerialNumber\":\"$(/usr/local/bin/bb-show-serial.sh)\",
echo "   "\"ts\":\"$(date +%s)\"
#,
#echo "   "\"txOsState\": {
#echo "      "\"osVersion\": \"$(uname -a)\",
#echo "      "\"rootFsSpaceUsed\": \"$(df -h | grep $(lsblk | grep / | cut -f2 -d'b' | cut -f1 -d' ') | cut -f5 -d' ')\",
#echo "      "\"rootFsSpaceAvailable\": \"$(df -h | grep $(lsblk | grep / | cut -f2 -d'b' | cut -f1 -d' ') | cut -f3 -d' ')\",
#echo "      "\"networkInterfaces\": \"$(sudo ifconfig | grep -A 1 encap | sed 's/-//g' | tr '\n' ' ' | sed 's/     / /g'| sed 's/    / /g'| sed 's/   / /g' | sed 's/  / /g')\",
#echo "      "\"topSumary\":\"$(top -b -n1 | head -5)\",
#echo "      "\"javaStatus\":\"PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND / $(top -b -n1 | grep java) / UID PID PPID C STIME TTY TIME CMD / $(ps -ef | grep -v grep | grep java)\"
#echo "   "}
echo ",   "\"txOsState\": {
echo "      "\"osVersion\": \"\",
echo "      "\"rootFsSpaceUsed\": \"\",
echo "      "\"rootFsSpaceAvailable\": \"\",
echo "      "\"networkInterfaces\": \"\",
echo "      "\"topSumary\":\"\",
echo "      "\"javaStatus\":\"\"
echo "   "}
echo }
