module.exports = (req, res) => {
  res.status(200).json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    msg: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    time: new Date().toISOString()
  });
};