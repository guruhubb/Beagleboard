import Adafruit_BBIO.UART as UART
import serial
import time
import sys
import random


def init_serial(port):
	UART.setup("UART%d" % port)
	ser = serial.Serial(port = "/dev/ttyO%d" % port, baudrate=115200)
	ser.close()
	ser.open()
	return ser

def getTxSerialNumber():
    with open ("/etc/wattupSerialNumber", "r") as myfile:
	    TxSerialNumber=myfile.read()
    return TxSerialNumber

def feedit(ser):
	rxSerials = [	'000010010010',
			'000020020020',
			'000030030030',
                     	'000040040040',
			'000050050050',
			'000060060060',
			'000070070070',
			'000080080080',
			'000090090090',
			'000100100100',
			'000110110110',
			'000120120120',
			'000130130130',
			'000140140140',
			'000150150150',
			'000160160160',
			'000170170170',
			'000180180180',
			'000190190190',
			'000200200200',
			'000210210210',
			'000220220220',
			'000230230230',
			'000240240240']
	totalNumAntennas = 32
        maxAntennaGroups = 4


	TxSerialNumber = getTxSerialNumber()
    	i = -1
    	for theRxSerial in rxSerials:
        	i += 1
		rxSerials[i]=TxSerialNumber + rxSerials[i]

	while True:
		random.shuffle(rxSerials)
                antennasRemaining = totalNumAntennas
                devicesInRange = random.randrange(3,24,1)
                for groupNum in xrange(devicesInRange):
                        print 'antennasRemaining     = ' + str(antennasRemaining)

			if antennasRemaining > 0:
				antennaNumInThisGroup = random.randrange(0,antennasRemaining,4)
			else:
				antennaNumInThisGroup = 0

			if groupNum == maxAntennaGroups:
				antennaNumInThisGroup = antennasRemaining	

			antennasRemaining = antennasRemaining - antennaNumInThisGroup
		        randomRXSerNo = rxSerials[groupNum]
			devicePower = random.randrange(0,2000,1)
			antennaPower = devicePower * (1 -  random.randrange(1,25,1) / 100)
			oLTE = random.randrange(1000,4294967295,1)
			iLTE = random.randrange(1000,4294967295,1)
			groupNumValue = groupNum
			if groupNum > maxAntennaGroups:
				groupNumValue = 0
				antennaPower = 0
				devicePower = 0
				


       			input_record='RDATA' + randomRXSerNo
       			input_record = input_record + str(format(devicePower,'04X'))
       			input_record = input_record + str(format(antennaPower,'04X'))
       			input_record = input_record + str(format(oLTE,'08X'))
       			input_record = input_record + str(format(iLTE,'08X'))
       			input_record = input_record + str(format(groupNumValue,'01X'))
       			input_record = input_record + str(format(maxAntennaGroups,'01X'))
       			input_record = input_record + str(format(antennaNumInThisGroup,'04X'))

			print 'RXSerNo               = ' + randomRXSerNo 
                        print 'devicePower           = ' + str(devicePower) + ' ' + str(format(devicePower,'04X'))
			print 'antennaPower          = ' + str(antennaPower) + ' ' + str(format(antennaPower,'04X'))
                        print 'oLTE                  = ' + str(oLTE) + ' ' + str(format(oLTE,'08X'))
                        print 'iLTE                  = ' + str(iLTE) + ' ' + str(format(iLTE,'08X'))
                        print 'groupNumValue         = ' + str(groupNumValue) + ' ' + str(format(groupNumValue,'01X'))
            		print 'maxAntennaGroups      = ' + str(maxAntennaGroups) + ' ' + str(format(maxAntennaGroups,'01X'))
            		print 'antennaNumInThisGroup = ' + str(antennaNumInThisGroup) + ' ' + str(format(antennaNumInThisGroup,'04X'))

			for antennaNum in xrange(antennaNumInThisGroup):
		        	phase = random.randrange(0,15,1) 
		        	magnitude = random.randrange(0,15,1) 
          			input_record = input_record + str(format(phase,'02X')) + str(format(magnitude,'02X'))
        			
            		input_record = input_record + 'ATADR'

		    	checksum = 0
			for i in input_record:
                                checksum = checksum + ord(i)
       			input_record = input_record + str(format(checksum,'04X')) + '\n'

            		print 'checksum = ' + str(checksum) + ' ' + str(format(checksum,'04X')) + '\n'

			for i in input_record:
				print hex(ord(i)),
			print '\n'

			ser.write(input_record)

                ser.write('-----------------------------------\r')
                print('-----------------------------------\r')
		
		time.sleep(1)

if __name__ == '__main__':
	port = 2
	try:
		port = int(sys.argv[1])
	except:
		pass
	print 'using serial port nr.%d' % port
	ser = None
	try:
		ser = init_serial(port)
		if ser.isOpen():
			print "Serial is open! ------------------------------------------------------------"
			feedit(ser)
	finally:
		if ser:
			ser.close()
