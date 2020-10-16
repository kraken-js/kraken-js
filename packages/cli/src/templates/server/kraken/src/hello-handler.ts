export const handler = async () => {
  return 'Hello from lambda: ' + process.env.AWS_LAMBDA_FUNCTION_NAME;
};
