import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import PDFDocument from "pdfkit";
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

export const getReportReceptionists = async (
  req,
  res
) => {
  try {
    const receptionists = await User.find({
      role: "receptionist",
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
      message:
        "Failed to fetch receptionists",
    });
  }
};

// =====================================
// GENERATE REPORT
// =====================================

// =====================================
// PDF HELPERS
// =====================================

const formatCurrency = (amount) => {
  return `NGN ${Number(amount || 0).toLocaleString()}`;
};

const formatDate = (date) => {
  if (!date) return "-";

  return dayjs(date)
    .tz(HOTEL_TIMEZONE)
    .format("DD MMM YYYY");
};

const formatDateTime = (date) => {
  if (!date) return "-";

  return dayjs(date)
    .tz(HOTEL_TIMEZONE)
    .format("DD MMM YYYY, HH:mm");
};

const drawTableHeader = (doc, columns, y) => {
  doc
    .fontSize(8)
    .font("Helvetica-Bold");

  columns.forEach((column) => {
    doc.text(
      column.label,
      column.x,
      y,
      {
        width: column.width,
        align: column.align || "left",
      }
    );
  });

  doc
    .moveTo(40, y + 14)
    .lineTo(555, y + 14)
    .stroke();

  doc.font("Helvetica");
};

const ensureSpace = (doc, requiredHeight = 50) => {
  if (
    doc.y + requiredHeight >
    doc.page.height - 60
  ) {
    doc.addPage();

    return true;
  }

  return false;
};

// =====================================
// BUILD REPORT PDF
// =====================================

const buildReportPDF = ({
  report,
  res,
}) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  res.setHeader(
    "Content-Type",
    "application/pdf"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="hotel-report-${report.period.startDate}-to-${report.period.endDate}.pdf"`
  );

  doc.pipe(res);

  // =====================================
  // HEADER
  // =====================================

  doc
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("SANDBERG GUEST HOUSE");

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .moveDown(0.5)
    .text("Operational Report");

  doc
    .fontSize(10)
    .font("Helvetica")
    .moveDown(0.5)
    .text(
      `Report Period: ${formatDate(report.period.startDate)} - ${formatDate(report.period.endDate)}`
    );

  doc.text(
    `Scope: ${report.scope}`
  );

  if (report.staff) {
    doc.text(
      `Receptionist: ${report.staff.fullName}`
    );
  }

  doc.moveDown(1);

  // =====================================
  // SUMMARY
  // =====================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("Summary");

  doc.moveDown(0.5);

  const summary = report.summary;

  const summaryItems = [
    [
      "Total Revenue",
      formatCurrency(
        summary.totalRevenue
      ),
    ],
    [
      "Total Check-ins",
      String(summary.totalCheckIns),
    ],
    [
      "Total Check-outs",
      String(summary.totalCheckOuts),
    ],
    [
      "Total Cancellations",
      String(
        summary.totalCancellations
      ),
    ],
  ];

  summaryItems.forEach(
    ([label, value]) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(label, {
          continued: true,
        });

      doc
        .font("Helvetica")
        .text(`    ${value}`);
    }
  );

  doc.moveDown(1);

  // =====================================
  // TRANSACTION BREAKDOWN
  // =====================================

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text("Transaction Breakdown");

  doc.moveDown(0.7);

  let tableY = doc.y;

  const columns = [
    {
      label: "Guest",
      x: 40,
      width: 85,
    },
    {
      label: "Room",
      x: 125,
      width: 40,
    },
    {
      label: "Rate",
      x: 165,
      width: 55,
    },
    {
      label: "Staff",
      x: 220,
      width: 80,
    },
    {
      label: "Status",
      x: 300,
      width: 70,
    },
    {
      label: "Total",
      x: 370,
      width: 75,
      align: "right",
    },
    {
      label: "Check-in",
      x: 445,
      width: 65,
    },
    {
      label: "Check-out",
      x: 510,
      width: 45,
    },
  ];

  drawTableHeader(
    doc,
    columns,
    tableY
  );

  tableY += 22;

  for (const transaction of report.breakdown) {
    if (
      tableY > doc.page.height - 100
    ) {
      doc.addPage();

      tableY = 50;

      drawTableHeader(
        doc,
        columns,
        tableY
      );

      tableY += 22;
    }

    const staffName =
      transaction.staff?.fullName ||
      "ONLINE";

    const rate =
      transaction.rate_type || "-";

    const checkIn =
      transaction.checkInAt
        ? formatDate(
            transaction.checkInAt
          )
        : "-";

    const checkOut =
      transaction.checkOutAt
        ? formatDate(
            transaction.checkOutAt
          )
        : "-";

    doc
      .fontSize(7)
      .font("Helvetica");

    doc.text(
      transaction.guestFullName || "-",
      40,
      tableY,
      {
        width: 85,
        height: 25,
      }
    );

    doc.text(
      transaction.roomNumber || "-",
      125,
      tableY,
      {
        width: 40,
      }
    );

    doc.text(
      rate,
      165,
      tableY,
      {
        width: 55,
      }
    );

    doc.text(
      staffName,
      220,
      tableY,
      {
        width: 80,
        height: 25,
      }
    );

    doc.text(
      transaction.status || "-",
      300,
      tableY,
      {
        width: 70,
        height: 25,
      }
    );

    doc.text(
      formatCurrency(
        transaction.total_charge
      ),
      370,
      tableY,
      {
        width: 75,
        align: "right",
      }
    );

    doc.text(
      checkIn,
      445,
      tableY,
      {
        width: 65,
      }
    );

    doc.text(
      checkOut,
      510,
      tableY,
      {
        width: 45,
      }
    );

    tableY += 32;

    // ---------------------------------
    // PRICING BREAKDOWN
    // ---------------------------------

    if (
      transaction.pricingBreakdown &&
      transaction.pricingBreakdown.length > 0
    ) {
      if (
        tableY >
        doc.page.height - 130
      ) {
        doc.addPage();
        tableY = 50;
      }

      doc
        .fontSize(7)
        .font("Helvetica-Oblique")
        .text(
          "Nightly pricing:",
          55,
          tableY
        );

      tableY += 11;

      transaction.pricingBreakdown.forEach(
        (night) => {
          doc
            .fontSize(7)
            .font("Helvetica")
            .text(
              `${formatDate(
                night.date
              )}  •  ${night.rate_type}  •  ${formatCurrency(
                night.applied_rate
              )}`,
              65,
              tableY
            );

          tableY += 10;
        }
      );

      tableY += 8;
    }
  }

  // =====================================
  // TOTAL REVENUE
  // =====================================

  if (
    tableY >
    doc.page.height - 100
  ) {
    doc.addPage();

    tableY = 50;
  }

  doc
    .moveTo(40, tableY)
    .lineTo(555, tableY)
    .stroke();

  tableY += 15;

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(
      `Total Revenue: ${formatCurrency(
        summary.totalRevenue
      )}`,
      40,
      tableY,
      {
        width: 515,
        align: "right",
      }
    );

  // =====================================
  // FOOTERS / PAGE NUMBERS
  // =====================================

  const range =
    doc.bufferedPageRange();

  for (
    let i = range.start;
    i < range.start + range.count;
    i++
  ) {
    doc.switchToPage(i);

    doc
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Sandberg Guest House • Generated ${formatDateTime(
          new Date()
        )}`,
        40,
        doc.page.height - 35,
        {
          width: 400,
        }
      );

    doc.text(
      `Page ${i + 1} of ${range.count}`,
      470,
      doc.page.height - 35,
      {
        width: 85,
        align: "right",
      }
    );
  }

  doc.end();
};

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

    const report = {
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
};

    // ---------------------------------
    // RESPONSE
    // ---------------------------------

    return buildReportPDF({
  report,
  res,
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