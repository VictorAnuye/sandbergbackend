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
  const tableLeft = 40;
  const tableRight = 555;
  const headerHeight = 22;

  doc
    .fontSize(8)
    .font("Helvetica-Bold");

  // Header text
  columns.forEach((column) => {
    doc.text(
      column.label,
      column.x + 5,
      y + 5,
      {
        width: column.width - 10,
        align: column.align || "left",
      }
    );
  });

  // Top border
  doc
    .moveTo(tableLeft, y)
    .lineTo(tableRight, y)
    .stroke();

  // Bottom border
  doc
    .moveTo(tableLeft, y + headerHeight)
    .lineTo(tableRight, y + headerHeight)
    .stroke();

  // Vertical column borders
  let currentX = tableLeft;

  doc
    .moveTo(currentX, y)
    .lineTo(currentX, y + headerHeight)
    .stroke();

  columns.forEach((column) => {
    currentX += column.width;

    doc
      .moveTo(currentX, y)
      .lineTo(currentX, y + headerHeight)
      .stroke();
  });

  doc.font("Helvetica");
};

const drawTableRowBorders = (
  doc,
  columns,
  y,
  height
) => {
  const tableLeft = 40;
  const tableRight = 555;

  // Bottom border
  doc
    .moveTo(tableLeft, y + height)
    .lineTo(tableRight, y + height)
    .stroke();

  // Vertical borders
  let currentX = tableLeft;

  doc
    .moveTo(currentX, y)
    .lineTo(currentX, y + height)
    .stroke();

  columns.forEach((column) => {
    currentX += column.width;

    doc
      .moveTo(currentX, y)
      .lineTo(currentX, y + height)
      .stroke();
  });
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
  // HEADER + SUMMARY
  // =====================================

  const headerTop = 40;

  // -------------------------------------
  // LEFT SIDE — REPORT INFORMATION
  // -------------------------------------
  doc
  .fontSize(22)
  .font("Helvetica-Bold")
  .text(
    "SANDBERG GUEST HOUSE",
    40,
    headerTop,
    {
      width: 285,
      lineBreak: false,
    }
  );

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(
      "Operational Report",
      40,
      headerTop + 32,
      {
        width: 270,
        lineBreak: false,
      }
    );

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      `Report Period: ${formatDate(
        report.period.startDate
      )} - ${formatDate(
        report.period.endDate
      )}`,
      40,
      headerTop + 58,
      {
        width: 270,
        lineBreak: false,
      }
    );

  doc.text(
    `Scope: ${report.scope}`,
    40,
    headerTop + 74,
    {
      width: 270,
      lineBreak: false,
    }
  );

  if (report.staff) {
    doc.text(
      `Receptionist: ${report.staff.fullName}`,
      40,
      headerTop + 90,
      {
        width: 270,
        lineBreak: false,
      }
    );
  }

  // -------------------------------------
  // RIGHT SIDE — SUMMARY
  // -------------------------------------

  const summaryX = 330;
  const summaryY = headerTop + 25;
  const summaryWidth = 225;

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(
      "Summary",
      summaryX,
      summaryY,
      {
        width: summaryWidth,
        lineBreak: false,
      }
    );

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

  let summaryYPosition =
    summaryY + 22;

  summaryItems.forEach(
    ([label, value]) => {
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(
          label,
          summaryX,
          summaryYPosition,
          {
            width: 120,
            lineBreak: false,
          }
        );

      doc
        .font("Helvetica")
        .text(
          value,
          summaryX + 120,
          summaryYPosition,
          {
            width: 105,
            align: "right",
            lineBreak: false,
          }
        );

      summaryYPosition += 14;
    }
  );

  // -------------------------------------
  // TRANSACTION BREAKDOWN TITLE
  // -------------------------------------

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .text(
      "Transaction Breakdown",
      40,
      155,
      {
        width: 515,
        lineBreak: false,
      }
    );

  let tableY = 175;


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
  const rowHeight = 25;
  const bottomMargin = 60;

  if (
    tableY + rowHeight >
    doc.page.height - bottomMargin
  ) {
    doc.addPage();

    tableY = 55;

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
  45,
  tableY + 7,
  {
    width: 75,
    height: 25,
  }
);

doc.text(
  transaction.roomNumber || "-",
  130,
  tableY + 7,
  {
    width: 30,
  }
);

doc.text(
  rate,
  170,
  tableY + 7,
  {
    width: 45,
  }
);

doc.text(
  staffName,
  225,
  tableY + 7,
  {
    width: 70,
    height: 25,
  }
);

doc.text(
  transaction.status || "-",
  305,
  tableY + 7,
  {
    width: 60,
    height: 25,
  }
);

doc.text(
  formatCurrency(
    transaction.total_charge
  ),
  375,
  tableY + 7,
  {
    width: 65,
    align: "right",
  }
);

doc.text(
  checkIn,
  450,
  tableY + 7,
  {
    width: 55,
  }
);

doc.text(
  checkOut,
  515,
  tableY + 7,
  {
    width: 35,
  }
);

  drawTableRowBorders(
    doc,
    columns,
    tableY,
    rowHeight
  );

  tableY += rowHeight;
}

  // =====================================
  // TOTAL REVENUE
  // =====================================
  // =====================================
  // TOTAL REVENUE
  // =====================================

  const totalRevenueHeight = 30;

  if (
    tableY + totalRevenueHeight >
    doc.page.height - 125
  ) {
    doc.addPage();

    tableY = 55;

    drawTableHeader(
      doc,
      columns,
      tableY
    );

    tableY += 22;
  }

  doc
    .moveTo(40, tableY)
    .lineTo(555, tableY)
    .stroke();

  tableY += 8;

  doc
    .fontSize(12)
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
        lineBreak: false,
      }
    );

  // =====================================
  // SIGNATURES
  // =====================================

  const signatureY =
    doc.page.height - 125;
doc
  .fontSize(9)
  .font("Helvetica-Bold")
  .text(
    "Receptionist Sign",
    40,
    signatureY,
    {
      width: 200,
      lineBreak: false,
    }
  );

doc
  .moveTo(40, signatureY + 45)
  .lineTo(240, signatureY + 45)
  .stroke();

doc
  .fontSize(9)
  .font("Helvetica-Bold")
  .text(
    "Manager Sign",
    355,
    signatureY,
    {
      width: 200,
      align: "right",
      lineBreak: false,
    }
  );

doc
  .moveTo(355, signatureY + 45)
  .lineTo(555, signatureY + 45)
  .stroke();

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

  const footerY =
    doc.page.height - 55;

  doc
    .fontSize(8)
    .font("Helvetica")
    .text(
      `Sandberg Guest House • Generated ${formatDateTime(
        new Date()
      )}`,
      40,
      footerY,
      {
        width: 400,
        lineBreak: false,
      }
    );

  doc.text(
    `Page ${i + 1} of ${range.count}`,
    470,
    footerY,
    {
      width: 85,
      align: "right",
      lineBreak: false,
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