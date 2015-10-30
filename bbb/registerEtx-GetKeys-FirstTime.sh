#!/bin/bash
SCRIPT_NAME=$0;
ARGS=$@;
if [ $(id -u) != 0 ]; then
        exec /bin/bash -c "/bin/echo zharptica | /usr/bin/sudo -S ${SCRIPT_NAME} $ARGS"
fi

echo ===========================================
echo Make sure to stop the wattup service first!
echo use:   service wattup stop
echo ===========================================
echo
echo


ENDPOINT=wup-stage


echo Using Server ${ENDPOINT}
echo
echo


#while true; do

if [ ! -f /etc/wattupApiKeys ]; then
	echo STarting Registration.
	SERIAL=$(/usr/local/bin/bb-show-serial.sh)
	pubKEYFILE=/home/ubuntu/wattup/src/public-1.pem	
	echo -n $SERIAL > plain.txt
	echo -n $SERIAL > /etc/wattupSerialNumber
	openssl rsautl -encrypt -inkey $pubKEYFILE -pubin -in plain.txt -out crypt.txt
	openssl enc -A -base64 -in crypt.txt -out crypt.txt.enc
  	cp ./crypt.txt.enc /etc/wattupSerialNumberEncrypted
	SERIAL_CRYPT=$(<./crypt.txt.enc)
	BODY='{"txSerialNumber":"'$SERIAL'","txSerialNumberEncrypted":"'$SERIAL_CRYPT'","noDuplicate":"1963"}'
	#BODY='{"txSerialNumber":"T-SBKeBBERWMOPG-07E1001-9991","txSerialNumberEncrypted":"eopK6+mOIrShjUJTi52egc+kaHwo8ZhWxRJg9V8sxF1pigS7a79nccY+wZlx3es72W3lnyNsbQAYVED2uvi6Tl6ULu942ucVcwEU3uZIvSwxh1yCTNJGXEZyJ51fQeUFwysxk6/92DqYH63DrAdFegpSy0c5C+GnTEnypYdPahUFUFNU+XIbMROe0FZ93UphSsUCzbty6NgpppmWoUKGSi6K+CYRPDhqHEDUsyO13qbBJ7Q4TebSuxeol/ZLCz8bHz7gzzGxzEi/sRAUalimHikrHw6+OkJPEaTSmQq9qLjDtB8gAeVJ9kuugsPUo3DAiYA7jWW7joGg9dC4USRuVw==","noDuplicate":"1963"}'
	curl -s -H "Accept-type: application/json" -H "Content-type: application/json; charset=utf-8" -X POST -d "$BODY" -o ./keys.txt http://${ENDPOINT}.energo.us/portal/api/v1/etx
	echo "Received API Keys:"
	cat keys.txt
	echo
	[ -f /etc/wattupApiKeys ] || cp  ./keys.txt /etc/wattupApiKeys
fi

accessApiKey=$(cat /etc/wattupApiKeys | cut -f 14 -d '"')
accessApiSecret=$(cat /etc/wattupApiKeys | cut -f 18 -d '"')

echo accessApiKey=$accessApiKey
echo accessApiSecret=$accessApiSecret

BODY='{"accessApiKey=":"'$accessApiKey'","accessApiSecret"="'$accessApiSecret'","grant_type"="etx"}'
curl -s -o token.json -H "Content-type: application/json" -X GET "http://${ENDPOINT}.energo.us/portal/api/v1/oauth/access_token?accessApiKey="$accessApiKey"&accessApiSecret="$accessApiSecret"&grant_type=etx"
#curl -s -H "Accept-type: application/json" -H "Content-type: application/json; charset=utf-8" -X POST -d "$BODY" -o ./token.json http://${ENDPOINT}.energo.us/portal/api/v1/oauth/access_token
echo
echo "Server Returned Token:"
cat ./token.json

#if grep --quiet refreshToken ./token.json; then
#  accToken=$(cat token.json | cut -f 16 -d '"')
#else
#  accToken=$(cat token.json | cut -f 4 -d '"')
#fi
accToken=$(cat token.json | cut -f 4 -d '"')
echo
echo accToken=$accToken
dataBody=$(cat /var/log/hbSimulData.json)
echo
#echo $dataBody
echo
curl -s -H "Content-type: application/json" -X POST -d "$dataBody" -o ./result.txt "http://${ENDPOINT}.energo.us/portal/api/v1/etx/hb?access_token="$accToken
echo "Data Send Result:"$(cat ./result.txt)
if grep -q Invalid ./result.txt ; then
	rm /etc/wattupApiKeys
	echo Erased the key file /etc/wattupApiKeys. Next time will try to register again.
fi
echo

#sleep 10s
#done


echo ===========================================
echo Make sure to restart the wattup service first!
echo use:   service wattup start
echo ===========================================
echo
echo


exit 0


