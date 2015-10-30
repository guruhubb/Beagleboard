#!/bin/bash
cp ./8812au.ko /lib/modules/$(uname -r)
rmmode 8812au
depmod -a
echo "8812au" >> /etc/modules
modprobe 8812au
