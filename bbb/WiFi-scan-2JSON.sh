#!/bin/bash
#
# This script requires that previously, the results of an iwlist scan
# were saved to $INPUT_FILE. Once that is the case, it converts the
# results of that scan into a JSON file which includes:
# Cell #, ESSID, Protocol (a/b/g/n/ac), Addresses, Frequency, Channel,
# Signal Level (in -dBs), and bit rate.
# This result can be piped to a file or sent to another process.
#
# Designed to be used from WiFiSetup.sh, in this repository. Only used
# and tested on Ubuntu on the Beaglebone Black, but there's no reason
# it would not work on a standard Ubuntu system AFAIK.
#
echo "Scanning WiFi SSIDs"
iwlist wlan1 scanning > /tmp/iwlist_scan_result

INPUT_FILE="/tmp/iwlist_scan_result"

read -a ESSIDS <<< $(grep ESSID ${INPUT_FILE} | sed 's/^\s*//g; s/ESSID/"&"/g; s/ /_/g')
read -a PROTOCOLS <<< $(grep Protocol ${INPUT_FILE} | sed 's/^\s*//g; s/Protocol/"&/g; s/IEEE 802.11/"/g; s/:.*/"&"/')
read -a ADDRESSES <<< $(grep Address ${INPUT_FILE} | cut -d - -f 2 | sed -e 's/ Address/"Address"/g; s/ /"/g; s/.*/&"/g')
read -a FREQUENCIES <<< $(grep Frequency ${INPUT_FILE} | cut -d \( -f 1 | sed 's/\s*Frequency:/"Frequency_GHz":"/g;s/ GHz /"/g')
read -a CHANNELS <<< $(grep Channel ${INPUT_FILE} | cut -d \( -f 2 | sed 's/Channel /"Channel":/g;s/)//g')
read -a SIGNAL_LEVELS <<< $(grep "Signal level" ${INPUT_FILE} | cut -d = -f 3 | sed 's/ dBm//g; s/-/"Signal_dB":-/g')
read -a BIT_RATES <<< $(grep "Bit Rates" ${INPUT_FILE} | cut -d : -f 2 | sed 's/ Mb\/s/"/g;s/.*/"Bit_Rate_Mb_per_s":"&/g')
NUMBER_OF_NETWORKS=${#ESSIDS[@]}

function ARRAYPRINT() {
	name=$1[@]
	b=$2
	a=("${!name}")
	echo -ne "\t\t${a[b]}"
}

function SEVERAL_ARRAYS() {
	ARRAYPRINT ESSIDS $1; echo ,
	ARRAYPRINT PROTOCOLS $1; echo ,
	ARRAYPRINT ADDRESSES $1; echo ,
	ARRAYPRINT FREQUENCIES $1; echo ,
	ARRAYPRINT CHANNELS $1; echo ,
	ARRAYPRINT SIGNAL_LEVELS $1; echo ,
	ARRAYPRINT BIT_RATES $1; echo
}

function CREATE_CELL_BLOCK() {
	CELL=$2
	ARRAYS=$1
	if [ $CELL -lt 10 ]; then
		echo -e "\t \"Cell 0$CELL\": {"
	else
		echo -e "\t \"Cell $CELL\": {"
	fi
	SEVERAL_ARRAYS $ARRAYS
	echo -ne "\t}"
	if [ $CELL -lt ${NUMBER_OF_NETWORKS} ]; then
		echo ,
	else
		echo
	fi
}

echo "{"

COUNTER=0
(( COUNTERPLUS=COUNTER+1 ))
while [ "${COUNTER}" -lt "${NUMBER_OF_NETWORKS}" ]
do
	CREATE_CELL_BLOCK $COUNTER $COUNTERPLUS
	((COUNTER++))
	((COUNTERPLUS++))
done

echo "}"
