let success = true;

function runTarget() {
  return success
    ? Promise.resolve()
    : Promise.reject(new Error('expected failure'));
}

runTarget.mockSuccess = () => {
  success = true;
};

runTarget.mockFailure = () => {
  success = false;
};

module.exports = runTarget;
