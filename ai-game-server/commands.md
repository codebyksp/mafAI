# Commands
List of commands

## Create room
curl -X POST http://localhost:3000/api/game/create \
  -H "Content-Type: application/json" \
  -d '{"hostId": "userID"}'

## Join room
curl -X POST http://localhost:3000/api/game/join \
  -H "Content-Type: application/json" \
  -d '{
    "gameCode": "####",
    "playerId": "userID"
  }'

## Start game
curl -X POST http://localhost:3000/api/game/start \
  -H "Content-Type: application/json" \
  -d '{
    "gameCode": "####"
  }'

## Submit Answer
curl -X POST http://localhost:3000/api/game/submit   -H "Content-Type: application/json"   -d '{
  "gameCode": "####",                                                                                               
  "round": #,
  "playerId": "userID",
  "answer": "I tripped and fell in front of the whole cafeteria during lunchh"
}'

## Vote
curl -X POST http://localhost:3000/api/game/vote \
  -H "Content-Type: application/json" \
  -d '{
    "gameCode": "####",
    "round": #,
    "voterId": "userID",
    "targetId": "userID"
  }'