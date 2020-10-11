export const hello = async () => {
  return process.env.hello + ' from lambda: ' + process.env.AWS_LAMBDA_FUNCTION_NAME;
};

export const message = async () => {
  return {
    message: 'message from lambda: ' + process.env.AWS_LAMBDA_FUNCTION_NAME
  };
};

