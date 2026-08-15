import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { SubmitRatingInput } from '../schemas/ratingSchemas.js';
import * as ratingService from '../services/ratingService.js';

export const submit: RequestHandler<{ id: string }, unknown, SubmitRatingInput> = async (
  req,
  res,
) => {
  const rating = await ratingService.submitRating(req.user!.id, req.params.id, req.body);
  sendSuccess(res, rating, 201);
};

export const list: RequestHandler<{ id: string }> = async (req, res) => {
  const ratings = await ratingService.listRatingsForBooking(req.user!.id, req.params.id);
  sendSuccess(res, { items: ratings });
};
