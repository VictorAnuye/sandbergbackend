import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import BookingTransaction from "../models/bookingTransaction.js";
import User from "../models/user.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const HOTEL_TIMEZONE = "Africa/Lagos";

// =====================================
// HELPERS
// =====================================

const getDateRange = (startDate, endDate) => {
  const start = dayjs
    .tz(startDate, HOTEL_TIMEZONE)
    .startOf("day");

  const end = dayjs
    .tz(endDate, HOTEL_TIMEZONE)
    .endOf("day");

  return {
    start: start.toDate(),
    end: end.toDate(),
  };
};

// =====================================
// GET RECEPTIONISTS
// =====================================

export const getReportReceptionists = async (req, res) => {
  try {
    const receptionists = await User.find({
      role: "receptionist",
      isActive: true,
    })
      .select("_id fullName")
      .sort({ fullName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      receptionists,
    });
  } catch (error) {
    console.error(
      "❌ GET REPORT RECEPTIONISTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch receptionists",
    });
  }
};

// =====================================
// GENERATE REPORT
// =====================================

export const generateReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      staffId,
      scope = "system",
    } = req.query;

    // ---------------------------------
    // VALIDATE DATES
    // ---------------------------------

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const { start, end } = getDateRange(
      startDate,
      endDate
    );

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
    }

    // ---------------------------------
    // DETERMINE STAFF FILTER
    // ---------------------------------

    let staffFilter = null;
    let reportScope = "SYSTEM-WIDE";
    let reportStaff = null;

    if (scope === "own") {
      // Receptionist can only request their own report.
      staffFilter = req.user._id;

      reportScope = "OWN ACTIVITIES";

      reportStaff = {
        _id: req.user._id,
        fullName: req.user.fullName,
      };
    }

    if (scope === "staff") {
      // Only admins can request another
      // receptionist's report.
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to generate another staff member's report",
        });
      }

      if (!staffId) {
        return res.status(400).json({
          success: false,
          message: "staffId is required",
        });
      }

      const receptionist = await User.findOne({
        _id: staffId,
        role: "receptionist",
        isActive: true,
      })
        .select("_id fullName")
        .lean();

      if (!receptionist) {
        return res.status(404).json({
          success: false,
          message: "Receptionist not found",
        });
      }

      staffFilter = receptionist._id;

      reportScope = receptionist.fullName;

      reportStaff = {
        _id: receptionist._id,
        fullName: receptionist.fullName,
      };
    }

    // ---------------------------------
    // BUILD TRANSACTION FILTER
    // ---------------------------------

    const transactionFilter = {
      $or: [
        {
          checkInAt: {
            $gte: start,
            $lte: end,
          },
        },
        {
          checkOutAt: {
            $gte: start,
            $lte: end,
          },
        },
        {
          cancelledAt: {
            $gte: start,
            $lte: end,
          },
        },
      ],
    };

    if (staffFilter) {
      transactionFilter.staff = staffFilter;
    }

    console.log(
      "📊 REPORT TRANSACTION FILTER:",
      transactionFilter
    );

    // ---------------------------------
    // FETCH TRANSACTIONS
    // ---------------------------------

    const transactions =
      await BookingTransaction.find(
        transactionFilter
      )
        .populate("staff", "fullName")
        .populate("room", "roomNumber roomType")
        .sort({ createdAt: 1 })
        .lean();

    // ---------------------------------
    // SUMMARY
    // ---------------------------------

    const totalCheckIns = transactions.filter(
      (transaction) =>
        transaction.checkInAt &&
        transaction.checkInAt >= start &&
        transaction.checkInAt <= end
    ).length;

    const totalCheckOuts = transactions.filter(
      (transaction) =>
        transaction.checkOutAt &&
        transaction.checkOutAt >= start &&
        transaction.checkOutAt <= end
    ).length;

    const totalCancellations =
      transactions.filter(
        (transaction) =>
          transaction.cancelledAt &&
          transaction.cancelledAt >= start &&
          transaction.cancelledAt <= end
      ).length;

    // ---------------------------------
    // REVENUE
    // ---------------------------------
    //
    // Revenue is based on the historical
    // transaction total, NOT today's room price.
    //
    // Cancelled transactions are excluded.
    // ---------------------------------

    const totalRevenue = transactions.reduce(
      (total, transaction) => {
        const checkInIsInRange =
          transaction.checkInAt &&
          transaction.checkInAt >= start &&
          transaction.checkInAt <= end;

        if (
          checkInIsInRange &&
          transaction.status !== "CANCELLED"
        ) {
          return (
            total +
            Number(
              transaction.total_charge ?? 0
            )
          );
        }

        return total;
      },
      0
    );

    // ---------------------------------
    // FORMAT TRANSACTION BREAKDOWN
    // ---------------------------------

    const breakdown = transactions.map(
      (transaction) => ({
        transactionId: transaction._id,

        bookingId: transaction.booking,

        guestFullName:
          transaction.guestFullName,

        roomNumber:
          transaction.roomNumber ??
          transaction.room?.roomNumber ??
          null,

        roomType:
          transaction.roomType ??
          transaction.room?.roomType ??
          null,

        rate_type:
          transaction.rate_type ?? null,

        total_charge:
          Number(
            transaction.total_charge ?? 0
          ),

        pricingBreakdown:
          transaction.pricingBreakdown ?? [],

        source: transaction.source,

        staff:
          transaction.staff
            ? {
                _id: transaction.staff._id,
                fullName:
                  transaction.staff.fullName,
              }
            : null,

        status: transaction.status,

        checkInAt:
          transaction.checkInAt,

        checkOutAt:
          transaction.checkOutAt,

        cancelledAt:
          transaction.cancelledAt,
      })
    );

    // ---------------------------------
    // RESPONSE
    // ---------------------------------

    return res.status(200).json({
      success: true,

      report: {
        period: {
          startDate,
          endDate,
        },

        scope: reportScope,

        staff: reportStaff,

        summary: {
          totalRevenue,
          totalCheckIns,
          totalCheckOuts,
          totalCancellations,
        },

        breakdown,
      },
    });
  } catch (error) {
    console.error(
      "❌ GENERATE REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate report",
    });
  }
};