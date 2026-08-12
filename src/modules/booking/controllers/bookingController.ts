import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { CreateBookingInput } from '../schemas/bookingSchemas.js';
import * as bookingService from '../services/bookingService.js';

// Mounted on rideRouter as POST /rides/:id/bookings — :id is the ride id.
export const create: RequestHandler<{ id: string }, unknown, CreateBookingInput> = async (req, res) => {
  const result = await bookingService.createBooking(req.user!.id, req.params.id, req.body);
  sendSuccess(res, result, 201);
};

export const getById: RequestHandler<{ id: string }> = async (req, res) => {
  const booking = await bookingService.getBooking(req.user!.id, req.params.id);
  sendSuccess(res, booking);
};

export const cancel: RequestHandler<{ id: string }> = async (req, res) => {
  const booking = await bookingService.cancelBooking(req.user!.id, req.params.id);
  sendSuccess(res, booking);
};
