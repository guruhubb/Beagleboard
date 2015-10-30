import Adafruit_BBIO.UART as UART
import serial
import time
import sys



def init_serial(port):
	UART.setup("UART%d" % port)
	ser = serial.Serial(port = "/dev/ttyO%d" % port, baudrate=115200)
	ser.close()
	ser.open()
	return ser

def feedit(ser):
	input_data = 'RDATA123456789ABC1F3D1234103F1AB11030340A14000AF372C483F145C783F0DAATADRF34D\r' * 2
	while True:
		for i in input_data:
			print hex(ord(i)),
		print '\n'
		ser.write(input_data)
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
			print "Serial is open!"
			feedit(ser)
	finally:
		if ser:
			ser.close()
