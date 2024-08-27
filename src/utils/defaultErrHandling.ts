import { Request, Response } from "express";
import dayjs from "dayjs";

export async function defaultErrorHandling(
  req: Request,
  res: Response,
  error: any,
) {
  const endpoint = req.path;
  const request = JSON.stringify(req.body);
  const response = JSON.stringify(
    error?.response?.message ??
      error?.message ??
      error ??
      "something went wrong!",
  );
  await req.prisma?.log_err_endpoint_access.create({
    data: {
      endpoint,
      request,
      response,
      date: dayjs().toISOString(),
    },
  });
  return res.status(400).json({
    code: 400,
    data: error?.data,
    info:
      error?.response?.message ??
      error?.message ??
      error ??
      "something went wrong!",
    error,
  });
}
