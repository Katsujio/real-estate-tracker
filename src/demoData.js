// demo data used by both landlord and renter portals.
// Lets the UI load instantly without calling the API.
export const demoRenterProfile = {
  id: 'renter-1',
  name: 'Taylor Ramos',
  email: 'renter@example.com',
  address: '101 Maple St, Savannah, GA',
  balance: 1200,
  monthlyRent: 1200,
  payDay: '1st of the month',
  contractLength: '12 months',
  contractEnd: '2026-01-01',
  paidThisMonth: false,
  paymentMethod: 'Visa ending in 8044',
};

export const demoPaymentHistory = [
  { id: 'pay-3', date: '2025-08-28', amount: 1250, method: 'Visa ending in 8044', note: 'Paid by you' },
  { id: 'pay-2', date: '2025-09-29', amount: 1250, method: 'Visa ending in 8044', note: 'Paid by you' },
  { id: 'pay-1', date: '2025-10-30', amount: 1250, method: 'Online payment', note: 'Paid by you' },
];

export const demoProperties = [
  {
    id: 'prop-1',
    landlordId: 'landlord-1',
    title: 'Maple Duplex',
    address: '101 Maple St, Savannah, GA',
    unitNumber: 'A',
    lease: {
      renterId: 'renter-1',
      renterName: 'Taylor Ramos',
      renterEmail: 'renter@example.com',
      startDate: '2025-01-01',
      endDate: '2026-01-01',
      monthlyRent: 1200,
      paymentDayOfMonth: 1,
      paidThisMonth: false,
    },
  },
  {
    id: 'prop-2',
    landlordId: 'landlord-1',
    title: 'Riverfront Fourplex',
    address: '202 River Rd, Savannah, GA',
    unitNumber: 'B',
    lease: null,
  },
];
