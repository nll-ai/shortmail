# Initialize app after first deploy
source .env
echo $PORT
# ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku letsencrypt:enable $DOKKU_APP_NAME"
ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku proxy:ports-set $DOKKU_APP_NAME http:80:$PORT https:443:$PORT"
# Set environment variable on Dokku based on local PORT env
ssh -t $DOKKU_USER@$DOKKU_HOST -- "dokku config:set $DOKKU_APP_NAME PORT=$PORT"
