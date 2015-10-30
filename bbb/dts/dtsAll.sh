#!/bin/bash
shopt -s nullglob
for f in *.dts
do
	overLay=$(ls $f | cut -f 1 -d ".")
	echo "Processing Overlay $overLay"
	dtc -O dtb -o $overLay.dtbo -b 0 -@ $overLay.dts
	cp $overLay.dtbo /lib/firmware/
done
 


