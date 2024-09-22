# Initialize app after first deploy
source .env
echo $PORT
# ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku letsencrypt:enable $DOKKU_APP_NAME"
ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku proxy:ports-set $DOKKU_APP_NAME http:80:$PORT" # https:443:$PORT"
ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku config:set $DOKKU_APP_NAME PORT=$PORT MAIL_HOST=$MAIL_HOST MAIL_PORT=$MAIL_PORT MAIL_USERNAME=$MAIL_USERNAME MAIL_PASSWORD=$MAIL_PASSWORD"
