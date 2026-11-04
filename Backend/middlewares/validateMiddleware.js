import ApiError from "../utlis/ApiError.js";

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return next(
      new ApiError(400, JSON.stringify(errors))
    );
  }

  req.validatedBody = result.data;
  return next();
};

export default validate;