// The backend works in whole rupees throughout — fareService, commissionService
// and the settlement math all Math.round(), and Razorpay conversion to paise
// happens only at the provider boundary. So the frontend never has sub-rupee
// amounts to render, and showing "₹850.00" would imply a precision the domain
// does not have.
const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatRupees(amount: number): string {
  return rupeeFormatter.format(amount);
}

// For the rare place a fare sits inside a sentence rather than a number slot.
export function formatRupeesPlain(amount: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

// Search results carry distances already rounded to 0.1 km by the backend;
// this only decides how to render them. Under 1 km reads better in metres —
// "700 m from your pickup" is more concrete than "0.7 km".
export function formatDistanceKm(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1).replace(/\.0$/, '')} km`;
}

// Ride durations come from the map provider in seconds.
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
