#!/bin/bash
[ -d /mnt/boot ] || mkdir /mnt/boot
mount /dev/mmcblk0p1 /mnt/boot
nano /mnt/boot/boot/uEnv.txt

