import { jsx, jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useCallback } from "react";
import {
  FiX,
  FiTrendingUp,
  FiBriefcase,
  FiDollarSign,
  FiShield,
  FiRotateCcw,
  FiRefreshCw,
  FiExternalLink,
  FiCheckCircle,
  FiClock,
  FiCheck,
  FiAlertTriangle
} from "react-icons/fi";
import PriceDisplay from "../../../../components/PriceDisplay";
import { useAdminFilter } from "../../../../context/AdminFilterContext";
import * as TransactionService from "../../../../services/TransactionService";
import { fmtDate, fmtDateOnly } from "../../../../utils/format";
const InfoRow = ({ label, value, mono = false, badge, onClick }) => /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4", children: [
  /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-500 font-medium shrink-0 pt-0.5", children: label }),
  onClick ? /* @__PURE__ */ jsxs(
    "button",
    {
      onClick,
      className: `text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 text-right ${mono ? "font-mono" : ""}`,
      children: [
        value,
        " ",
        /* @__PURE__ */ jsx(FiExternalLink, { className: "w-3 h-3 inline shrink-0" })
      ]
    }
  ) : /* @__PURE__ */ jsx("span", { className: `text-xs font-semibold text-slate-800 text-right ${mono ? "font-mono break-all" : ""}`, children: badge || value || "\u2014" })
] });
const SectionCard = ({ title, icon: Icon, iconColor = "text-blue-600", children }) => /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden", children: [
  /* @__PURE__ */ jsxs("div", { className: "px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50", children: [
    Icon && /* @__PURE__ */ jsx(Icon, { className: `w-4 h-4 ${iconColor}` }),
    /* @__PURE__ */ jsx("h3", { className: "text-xs font-extrabold text-slate-700 uppercase tracking-wider", children: title })
  ] }),
  /* @__PURE__ */ jsx("div", { className: "px-5 py-4", children })
] });
const StatusChip = ({ label, type = "default" }) => {
  const types = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    default: "bg-slate-100 text-slate-600 border-slate-200"
  };
  return /* @__PURE__ */ jsx("span", { className: `inline-flex items-center px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border rounded-full ${types[type]}`, children: label });
};
const ProviderEarningDetailModal = ({ isOpen, onClose, entityData, earningId }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const { openInvestigationDrawer } = useAdminFilter();
  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || earningId;
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await TransactionService.getAdminPaymentDetails(targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn("Falling back to local earning record data:", err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, earningId]);
  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);
  if (!isOpen) return null;
  const data = details || entityData || {};
  const booking = data.booking || {};
  const customer = data.customer || data.user || booking.customer || {};
  const provider = data.provider || booking.provider || {};
  const refund = data.refund || null;
  const settlement = data.settlement || {};
  const paymentRecord = data.paymentRecord || {};
  const customerPaid = data.amount || data.totalAmount || booking.totalAmount || booking.subtotal || 0;
  const commission = data.commission !== void 0 && data.commission !== null ? data.commission : booking.commissionAmount !== void 0 && booking.commissionAmount !== null ? booking.commissionAmount : data.platformFee || 0;
  const serviceBase = data.grossAmount || booking.subtotal || customerPaid;
  const providerShare = data.providerEarnings || data.providerEarning || data.netAmount || serviceBase - commission;
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: "bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3.5", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary", children: /* @__PURE__ */ jsx(FiTrendingUp, { className: "w-6 h-6" }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("h2", { className: "text-xl font-black tracking-tight", children: "Provider Net Earning Detail" }),
            /* @__PURE__ */ jsx(StatusChip, { label: "NET SHARE", type: "success" })
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-xs text-neutral-300 font-medium mt-0.5", children: [
            "Booking ID: ",
            /* @__PURE__ */ jsx("span", { className: "font-mono font-bold text-white", children: booking.bookingId || data.bookingId || `#${(data._id || "").slice(-6)}` })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: fetchDetail,
            className: "p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer",
            title: "Refresh",
            children: /* @__PURE__ */ jsx(FiRefreshCw, { className: `w-4 h-4 ${loading ? "animate-spin" : ""}` })
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: onClose,
            className: "p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer",
            children: /* @__PURE__ */ jsx(FiX, { className: "w-5 h-5" })
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "p-6 overflow-y-auto flex-1 space-y-6", children: [
      /* @__PURE__ */ jsx("div", { className: "p-5 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 rounded-2xl border border-blue-100/80 shadow-2xs", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 font-bold uppercase tracking-wider", children: "Customer Paid" }),
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-black text-slate-900 mt-1", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: customerPaid }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs text-rose-600 font-bold uppercase tracking-wider", children: "Platform Commission" }),
          /* @__PURE__ */ jsxs("p", { className: "text-2xl font-black text-rose-600 mt-1", children: [
            "- ",
            /* @__PURE__ */ jsx(PriceDisplay, { amount: commission })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("p", { className: "text-xs text-emerald-700 font-bold uppercase tracking-wider", children: "Provider Net Share" }),
          /* @__PURE__ */ jsx("p", { className: "text-2xl font-black text-emerald-700 mt-1", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: providerShare }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
        /* @__PURE__ */ jsxs(SectionCard, { title: "1. Booking Information", icon: FiBriefcase, children: [
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Booking ID",
              value: booking.bookingId || data.bookingId || "N/A",
              onClick: () => openInvestigationDrawer("booking", booking._id || data.booking)
            }
          ),
          /* @__PURE__ */ jsx(InfoRow, { label: "Booking Status", badge: /* @__PURE__ */ jsx(StatusChip, { label: (booking.status || "completed").toUpperCase(), type: "success" }) }),
          /* @__PURE__ */ jsx(InfoRow, { label: "Service Title", value: booking.services?.[0]?.service?.title || "Home Service" }),
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Customer Name",
              value: customer.name || "Customer",
              onClick: () => openInvestigationDrawer("customer", customer._id || data.user)
            }
          ),
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Provider Name",
              value: provider.name || "Provider",
              onClick: () => openInvestigationDrawer("provider", provider._id || data.provider)
            }
          ),
          /* @__PURE__ */ jsx(InfoRow, { label: "Booking Date", value: fmtDate(booking.createdAt || data.createdAt) })
        ] }),
        /* @__PURE__ */ jsxs(SectionCard, { title: "2. Payment Information", icon: FiDollarSign, children: [
          /* @__PURE__ */ jsx(InfoRow, { label: "Payment Method", value: (data.paymentMethod || booking.paymentMethod || "online").toUpperCase() }),
          /* @__PURE__ */ jsx(InfoRow, { label: "Payment Type", value: (data.type || "payment").toUpperCase() }),
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Amount Paid",
              badge: /* @__PURE__ */ jsx("span", { className: "font-black text-slate-900", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: customerPaid }) })
            }
          ),
          /* @__PURE__ */ jsx(InfoRow, { label: "Transaction Ref", value: data.transactionId || data.razorpayPaymentId || `#${(data._id || "").slice(-6)}`, mono: true }),
          /* @__PURE__ */ jsx(InfoRow, { label: "Payment Status", badge: /* @__PURE__ */ jsx(StatusChip, { label: (data.paymentStatus || "success").toUpperCase(), type: "success" }) })
        ] }),
        /* @__PURE__ */ jsxs(SectionCard, { title: "3. Settlement Information", icon: FiShield, children: [
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Settlement Status",
              badge: /* @__PURE__ */ jsx(StatusChip, { label: settlement.settlementStatus || (data.paymentStatus === "success" ? "SETTLED" : "PENDING"), type: "success" })
            }
          ),
          /* @__PURE__ */ jsx(InfoRow, { label: "Settlement Date", value: fmtDate(settlement.settlementDate || data.updatedAt) }),
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Settlement Amount",
              badge: /* @__PURE__ */ jsx("span", { className: "font-bold text-slate-900", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: settlement.settlementAmount || providerShare }) })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs(SectionCard, { title: "4. Withdrawal Information", icon: FiTrendingUp, children: [
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Withdrawal Status",
              badge: /* @__PURE__ */ jsx(StatusChip, { label: (paymentRecord.status || "AVAILABLE FOR PAYOUT").toUpperCase(), type: paymentRecord.status === "completed" ? "success" : "info" })
            }
          ),
          /* @__PURE__ */ jsx(
            InfoRow,
            {
              label: "Withdrawal Amount",
              badge: /* @__PURE__ */ jsx("span", { className: "font-bold text-emerald-600", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: paymentRecord.amount || providerShare }) })
            }
          ),
          /* @__PURE__ */ jsx(InfoRow, { label: "Transfer Date", value: paymentRecord.completedAt ? fmtDate(paymentRecord.completedAt) : "Pending Withdrawal" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(SectionCard, { title: "5. Refund Impact", icon: FiRotateCcw, children: refund ? /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx(InfoRow, { label: "Refund Amount", badge: /* @__PURE__ */ jsx("span", { className: "font-bold text-rose-600", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: refund.refundAmount || refund.amount || 0 }) }) }),
        /* @__PURE__ */ jsx(InfoRow, { label: "Refund Status", badge: /* @__PURE__ */ jsx(StatusChip, { label: (refund.refundStatus || refund.status || "completed").toUpperCase(), type: "danger" }) }),
        /* @__PURE__ */ jsx(InfoRow, { label: "Provider Deduction", value: refund.providerDeduction ? `\u20B9${refund.providerDeduction}` : "No Deduction Applied" })
      ] }) : /* @__PURE__ */ jsxs("div", { className: "p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(FiCheckCircle, { className: "w-4 h-4 text-emerald-600" }),
        "No Refund Impact \u2014 Full provider net share credited."
      ] }) }),
      /* @__PURE__ */ jsx(SectionCard, { title: "6. Lifecycle Timeline", icon: FiClock, children: /* @__PURE__ */ jsxs("div", { className: "space-y-4 text-xs", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800", children: "Booking Created" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: fmtDate(booking.createdAt || data.createdAt) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800", children: "Payment Completed" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: fmtDate(data.createdAt) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800", children: "Work Completed" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: fmtDate(booking.completedAt || data.createdAt) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: "w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800", children: "Settlement" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: fmtDate(settlement.settlementDate || data.updatedAt) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-3", children: [
          /* @__PURE__ */ jsx("div", { className: `w-3 h-3 rounded-full ${paymentRecord.status === "completed" ? "bg-emerald-500" : "bg-amber-400"} mt-0.5 shrink-0` }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "font-bold text-slate-800", children: "Withdrawal" }),
            /* @__PURE__ */ jsx("p", { className: "text-[11px] text-slate-400 mt-0.5", children: paymentRecord.completedAt ? fmtDate(paymentRecord.completedAt) : "Pending Payout Request" })
          ] })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0", children: [
      /* @__PURE__ */ jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Provider Earnings Module \u2022 Calculated from Backend Single Source" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onClose,
          className: "px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer",
          children: "Close Details"
        }
      )
    ] })
  ] }) });
};
export default ProviderEarningDetailModal;
