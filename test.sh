#!/bin/bash

set -ex

# Simple script to test against a live API, to be replaced by a proper jest setup

SERVER=$(cat outputs.json | jq -r '.development["convert-backend-url"]')

CODE=$(cat fixture.hcl)

curl -X POST -H "Content-Type: application/json" \
    -d "{ 'code': $CODE }" \
    "$SERVER"


