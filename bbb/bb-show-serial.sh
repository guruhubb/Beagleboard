#!/bin/sh
#
# This script reads the serial number from the i2c-connected eeprom available
# on BeagleBone (Black). It should work both on device-tree and pre-device-tree
# kernels.
#
# The serial number is unique for each BeagleBone (Black) and also includes
# the week/year of manufacture in the first 4 digits.
SCRIPT_VERSION="2.1"
SCRIPT_NAME=$0;
ARGS=$@;
OS_USERNAME=$( id |cut -f 2 -d "(" | cut -f 1 -d ")")
if [ "${OS_USERNAME}" != "root" ]; then
    echo "<=======================================================================>"
    echo '  You must execute this script as user "root" (sudo su). Exiting.        '
    echo "<=======================================================================>"
    exit 1
fi

notif () {
   echo -n "${1}"
}

fail () {
   echo -n "${1}"
   exit 0
}

checks () {
   if ! [ $(id -u) = 0 ]; then
      fail "you need to be root to run this (or use sudo)."
   fi
   
   has_hexdump=$(which hexdump 2>/dev/null)
   if [ ! "${has_hexdump}" ]; then
      fail "you need to install the BSD utils (apt-get install bsdmainutils)."
   fi
}

print_serial () {
   EEPROM="/sys/bus/i2c/devices/1-0050/eeprom"
   
   if [ ! -f "${EEPROM}" ]; then
      EEPROM="/sys/bus/i2c/devices/0-0050/eeprom"
   fi
   
   if [ ! -f "${EEPROM}" ]; then
      fail "i2c eeprom file not found in sysfs."
   fi
   
   SERIAL=$(hexdump -e '8/1 "%c"' "${EEPROM}" -s 16 -n 12 2>&1)
   
   if [ "${SERIAL}" = "${SERIAL#*BB}" ]; then
      fail "failed to extract serial number from i2c eeprom: " "${SERIAL}"
   fi
   
   notif ${SERIAL}
}

print_serial
