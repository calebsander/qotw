const constants = require(__dirname + '/constants.js')

function ifErrThrowErr(err) {
  if (err) throw err
}
module.exports = redisClient => {
  return (voteData, res) => {
    redisClient.sismember(constants.VOTE_TOKENS, voteData.token || '', (err, isMember) => {
      if (err) throw err
      if (isMember) {
        if (voteData.quote) {
          redisClient.hincrby(constants.CURRENT_VOTES, voteData.quote, 1, ifErrThrowErr)
          redisClient.srem(constants.VOTE_TOKENS, voteData.token, ifErrThrowErr)
          res.end(JSON.stringify({success: true}))
          console.log('Vote for:')
          console.log(voteData.quote)
        }
        else res.end(JSON.stringify({success: false, message: 'No quote specified'}))
      }
      else res.end(JSON.stringify({success: false, message: 'Invalid vote token'}))
    })
  }
}