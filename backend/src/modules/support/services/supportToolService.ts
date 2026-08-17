import { z } from 'zod';

import type { AIToolCall, AIToolDefinition } from '../../../infrastructure/ai/aiProvider.js';
import { AppError } from '../../../shared/errors/AppError.js';
import * as bookingService from '../../booking/services/bookingService.js';
import * as rideService from '../../ride/services/rideService.js';

// claude.md §96.5 (Tool/context layer): every schema below is deliberately
// missing a userId/identity parameter — the model's only degree of freedom
// is which tool to call and which resource id to pass. `executeToolCall`
// always binds `userId` from the authenticated request context, never from
// the model's arguments (see that function below).
export const SUPPORT_TOOL_DEFINITIONS: AIToolDefinition[] = [
  {
    name: 'getMyRecentBookings',
    description:
      "List the authenticated user's most recent bookings as a passenger, with status and fare.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'getBookingStatus',
    description:
      "Get the status and details of one of the authenticated user's own bookings, by booking id.",
    parameters: {
      type: 'object',
      properties: { bookingId: { type: 'string', description: 'The booking id' } },
      required: ['bookingId'],
      additionalProperties: false,
    },
  },
  {
    name: 'getMyRecentRidesAsDriver',
    description:
      "List the authenticated user's most recent rides created as a driver, with status and seats.",
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'getRideStatus',
    description:
      'Get the status and details of a ride by ride id (any ride — matches what any Rydex user can already see when viewing ride details, not restricted to rides the caller drives or booked).',
    parameters: {
      type: 'object',
      properties: { rideId: { type: 'string', description: 'The ride id' } },
      required: ['rideId'],
      additionalProperties: false,
    },
  },
];

const bookingIdArgsSchema = z.object({ bookingId: z.string().min(1) });
const rideIdArgsSchema = z.object({ rideId: z.string().min(1) });

export interface ToolExecutionResult {
  content: string;
  isError: boolean;
}

function invalidArgsResult(message: string): ToolExecutionResult {
  return { content: JSON.stringify({ error: message }), isError: true };
}

// Tool results were previously the raw service DTOs, JSON-stringified whole.
// For a ride that meant shipping `routeGeometry` — a MultiLineString of every
// coordinate on the route, ~10KB of digits — into the model's context on each
// lookup, which burns tokens and crowds the context window for data no support
// answer can use (§96.5 Cost control). It also handed a passenger the driver's
// `postingCommissionAmount`.
//
// These projections keep the ownership-checked service calls exactly as they
// are and trim only what reaches the model: the fields a support answer is
// actually phrased from.
// Every amount Rydex stores is whole rupees (fareService/commissionService
// round to integers; conversion to paise happens only at the Razorpay
// boundary). Stating that in the payload keeps the model from guessing a
// currency or treating the value as minor units.
const MONEY_CURRENCY = 'INR';

function toSupportRide(ride: Awaited<ReturnType<typeof rideService.getRide>>) {
  return {
    id: ride.id,
    currency: MONEY_CURRENCY,
    status: ride.status,
    departureTime: ride.departureTime,
    availableSeats: ride.availableSeats,
    totalSeats: ride.totalSeats,
    farePerSeat: ride.farePerSeat,
    distanceMeters: ride.distanceMeters,
    durationSeconds: ride.durationSeconds,
    origin: {
      latitude: ride.origin.latitude,
      longitude: ride.origin.longitude,
      address: ride.origin.address,
    },
    destination: {
      latitude: ride.destination.latitude,
      longitude: ride.destination.longitude,
      address: ride.destination.address,
    },
  };
}

function toSupportBooking(booking: Awaited<ReturnType<typeof bookingService.getBooking>>) {
  return {
    id: booking.id,
    currency: MONEY_CURRENCY,
    rideId: booking.rideId,
    status: booking.status,
    seatCount: booking.seatCount,
    farePerSeat: booking.farePerSeat,
    totalFare: booking.totalFare,
    prepaidAmount: booking.prepaidAmount,
    createdAt: booking.createdAt,
  };
}

// claude.md §96.5: dispatches only to existing ownership-checked service
// methods — never touches Prisma/SQL directly, never receives userId from
// the model. A tool failure (bad arguments, not-found/not-owned) becomes a
// tool-result message fed back to the model rather than an error that
// aborts the whole turn, so the assistant can tell the user it couldn't
// find that booking/ride instead of the request failing outright. Only a
// genuinely unexpected (non-AppError) failure propagates.
export async function executeToolCall(
  userId: string,
  call: AIToolCall,
): Promise<ToolExecutionResult> {
  try {
    switch (call.name) {
      case 'getMyRecentBookings': {
        const bookings = await bookingService.getMyRecentBookings(userId);
        return { content: JSON.stringify(bookings.map(toSupportBooking)), isError: false };
      }
      case 'getBookingStatus': {
        const parsed = bookingIdArgsSchema.safeParse(call.arguments);
        if (!parsed.success) {
          return invalidArgsResult('Missing or invalid bookingId');
        }
        const booking = await bookingService.getBooking(userId, parsed.data.bookingId);
        return { content: JSON.stringify(toSupportBooking(booking)), isError: false };
      }
      case 'getMyRecentRidesAsDriver': {
        // Already a lean summary (RideSummaryDto — no geometry/coordinates),
        // so the only projection needed is the currency marker its
        // `farePerSeat` would otherwise be missing.
        const rides = await rideService.getMyRecentRidesAsDriver(userId);
        return {
          content: JSON.stringify(rides.map((ride) => ({ ...ride, currency: MONEY_CURRENCY }))),
          isError: false,
        };
      }
      case 'getRideStatus': {
        const parsed = rideIdArgsSchema.safeParse(call.arguments);
        if (!parsed.success) {
          return invalidArgsResult('Missing or invalid rideId');
        }
        const ride = await rideService.getRide(parsed.data.rideId);
        return { content: JSON.stringify(toSupportRide(ride)), isError: false };
      }
      default:
        return invalidArgsResult(`Unknown tool: ${call.name}`);
    }
  } catch (err) {
    // An ownership-check failure (e.g. BOOKING_NOT_FOUND) or another
    // expected AppError — surfaced to the model as a tool error rather than
    // rethrown, so the conversation continues gracefully.
    if (err instanceof AppError) {
      return invalidArgsResult(err.message);
    }
    throw err;
  }
}
