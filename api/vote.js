const constants = require(__dirname + '/constants.js');

module.exports = (redisClient) => {
  return (voteData, res) => {
    redisClient.sismember(constants.VOTE_TOKENS, voteData.token || '', (err, isMember) => {
      if (err) throw err;
      else {
        if (isMember) {
          if (voteData.quote) {
            redisClient.hincrby(constants.CURRENT_VOTES, voteData.quote, 1, (err) => {
              if (err) throw err;
            });
            redisClient.srem(constants.VOTE_TOKENS, voteData.token, (err) => {
              if (err) throw err;
            });
            res.end(JSON.stringify({'success': true}));
          }
          else res.end(JSON.stringify({'success': false, 'message': 'No quote specified'}));
        }
        else res.end(JSON.stringify({'success': false, 'message': 'Invalid vote token'}));
      }
    });
  };
};