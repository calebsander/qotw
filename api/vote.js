const constants = require(__dirname + '/constants.js')

function ifErrThrowErr(err) {
  if (err) throw err
}
module.exports = redisClient => {
  return (voteData, res) => {
    redisClient.sismember(constants.VOTE_TOKENS, voteData.token || '', (err, isMember) => {
      if (err) throw err
      if (isMember) {
        redisClient.lrange(constants.PARAGRAPHS, 0, -1, (err, paragraphs) => {
          if (err) throw err
          const {index} = voteData
          if (index && index.constructor === Number && index >= 0 && index < paragraphs.length) {
            const votedParagraph = paragraphs[index]
            redisClient.hincrby(constants.CURRENT_VOTES, votedParagraph, 1, ifErrThrowErr)
            redisClient.srem(constants.VOTE_TOKENS, voteData.token, ifErrThrowErr)
            res.end(JSON.stringify({success: true}))
            console.log('Vote for:')
            console.log(votedParagraph)
          }
          else res.end(JSON.stringify({success: false, message: 'No quote specified'}))
        })
      }
      else res.end(JSON.stringify({success: false, message: 'Invalid vote token'}))
    })
  }
}