import type { RequestHandler } from 'express';

import { sendSuccess } from '../../../shared/http/response.js';
import type { CreateBookingInput, ListBookingsQuery } from '../schemas/bookingSchemas.js';
import * as bookingService from '../services/bookingService.js';

// Mounted on rideRouter as POST /rides/:id/bookings — :id is the ride id.
export const create: RequestHandler<{ id: string }, unknown, CreateBookingInput> = async (req, res) => {
  const result = await bookingService.createBooking(req.user!.id, req.params.id, req.body);
  sendSuccess(res, result, 201);
};

// Query is validated/coerced by validateQuery into req.validatedQuery
// (see app/middleware/validate.ts — Express 5's req.query has no setter).
export const list: RequestHandler = async (req, res) => {
  const query = req.validatedQuery as ListBookingsQuery;
  const result = await bookingService.listMyBookings(
    req.user!.id,
    query.scope,
    query.cursor,
    query.limit,
  );
  sendSuccess(res, result);
};

// Mounted on rideRouter as GET /rides/:id/bookings — :id is the ride id.
export const listForRide: RequestHandler<{ id: string }> = async (req, res) => {
  const result = await bookingService.listRideBookings(req.user!.id, req.params.id);
  sendSuccess(res, result);
};

export const getById: RequestHandler<{ id: string }> = async (req, res) => {
  const booking = await bookingService.getBooking(req.user!.id, req.params.id);
  sendSuccess(res, booking);
};

export const cancel: RequestHandler<{ id: string }> = async (req, res) => {
  const booking = await bookingService.cancelBooking(req.user!.id, req.params.id);
  sendSuccess(res, booking);
};
