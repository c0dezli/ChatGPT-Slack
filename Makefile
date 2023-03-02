SHELL := /bin/bash

deploy:
	zip -r myfiles.zip . && aws lambda update-function-code --region us-east-1 --function-name <Your Lambda Function Name> --zip-file fileb://myfiles.zip