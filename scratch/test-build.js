import { jsx, jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { FiTrendingUp, FiCheckCircle, FiClock, FiEye, FiShield } from "react-icons/fi";
import * as TransactionService from "../../../services/TransactionService";
import TableSkeleton from "../../../components/ui-skeletons/TableSkeleton";
import Pagination from "../../../components/ui/Pagination";
import PriceDisplay from "../../../components/PriceDisplay";
import { useAdminFilter } from "../../../context/AdminFilterContext";
import { fmtDate } from "../../../utils/format";
import usePagination from "../../../hooks/usePagination";
import useDebounce from "../../../hooks/useDebounce";
import Error from "../../../components/ui/Error";
const ProviderEarningsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);
  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);
  const abortControllerRef = useRef(null);
  const fetchEarnings = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch, type: "payment" });
      const res = await TransactionService.getAllTransactions(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success) {
        const list = res.data.data.transactions || res.data.data || [];
        setTransactions(list);
        setPaginationData({
          total: res.data.data.total || res.data.total || list.length,
          pages: res.data.data.totalPages || res.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        console.error("Error loading provider earnings:", err);
        setError("Failed to fetch live provider earnings records.");
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);
  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);
  return /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("h1", { className: "text-2xl font-black text-secondary tracking-tight flex items-center", children: [
          /* @__PURE__ */ jsx("span", { className: "p-2 bg-primary/10 text-primary rounded-xl mr-3", children: /* @__PURE__ */ jsx(FiTrendingUp, { className: "w-6 h-6" }) }),
          "Provider Net Earnings Console"
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-neutral-500 mt-1 font-medium", children: "Simple, lightweight, and production-ready job earnings ledger showing exact customer payments, platform commissions, provider net shares, settlement, and withdrawal statuses." })
      ] }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: fetchEarnings,
          className: "text-xs bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 font-bold shadow-sm transition-all flex items-center gap-1.5 self-start md:self-auto",
          children: [
            /* @__PURE__ */ jsx(FiShield, { className: "w-4 h-4" }),
            " Refresh Earnings"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden", children: [
      loading ? /* @__PURE__ */ jsx(TableSkeleton, { rows: 6, columns: 9, standalone: true }) : error ? /* @__PURE__ */ jsx(Error, { title: "Earnings Data Error", message: error, onRetry: fetchEarnings }) : transactions.length === 0 ? /* @__PURE__ */ jsx("div", { className: "p-12 text-center text-neutral-500 text-sm font-medium", children: "No provider earning records found." }) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-xs text-secondary min-w-[1100px]", children: [
        /* @__PURE__ */ jsx("thead", { className: "bg-neutral-50 text-neutral-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-neutral-100", children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Booking ID" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Customer Paid" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Platform Commission" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Provider Net Share" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Settlement Status" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Withdrawal Status" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Status" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5", children: "Date" }),
          /* @__PURE__ */ jsx("th", { className: "p-3.5 text-right", children: "Actions" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-neutral-100 font-medium", children: transactions.map((txn) => {
          const isWithdrawal = txn.type === "withdrawal" || txn.ledgerType === "withdrawal" || txn.bookingId && txn.bookingId.startsWith("WDL-");
          const customerPaid = isWithdrawal ? 0 : txn.amount || txn.booking?.totalAmount || 0;
          const commission = isWithdrawal ? 0 : txn.commission !== void 0 && txn.commission !== null ? txn.commission : txn.booking?.commissionAmount !== void 0 && txn.booking?.commissionAmount !== null ? txn.booking.commissionAmount : null;
          const providerNetShare = isWithdrawal ? 0 : txn.providerEarning !== void 0 && txn.providerEarning !== null ? txn.providerEarning : txn.booking?.providerEarnings !== void 0 && txn.booking?.providerEarnings !== null ? txn.booking.providerEarnings : commission !== null ? customerPaid - commission : null;
          const settlementStatus = txn.settlementStatus || (["success", "completed"].includes(txn.paymentStatus) ? "Settled" : "Pending");
          const withdrawalStatus = txn.withdrawalStatus || "Available";
          const isCompleted = ["success", "completed"].includes(txn.paymentStatus);
          return /* @__PURE__ */ jsxs("tr", { className: "hover:bg-neutral-50/50 transition-colors", children: [
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-bold text-secondary", children: isWithdrawal ? /* @__PURE__ */ jsx("span", { className: "font-mono text-neutral-400", children: "Withdrawal" }) : /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => openInvestigationDrawer("booking", txn.booking?._id || txn.booking || txn._id),
                className: "text-primary font-mono hover:underline",
                children: txn.booking?.bookingId || txn.bookingId || `#${txn._id.slice(-6)}`
              }
            ) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-bold text-secondary text-sm", children: /* @__PURE__ */ jsx(PriceDisplay, { amount: customerPaid }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-bold text-danger", children: commission !== null && commission !== void 0 ? /* @__PURE__ */ jsx(PriceDisplay, { amount: commission }) : /* @__PURE__ */ jsx("span", { className: "text-neutral-400 font-medium text-xs", children: "N/A" }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-black text-success text-sm", children: providerNetShare !== null && providerNetShare !== void 0 ? /* @__PURE__ */ jsx(PriceDisplay, { amount: providerNetShare }) : /* @__PURE__ */ jsx("span", { className: "text-neutral-400 font-medium text-xs", children: "N/A" }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-bold text-secondary", children: /* @__PURE__ */ jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold ${settlementStatus.toLowerCase().includes("settled") ? "bg-success-light text-success" : "bg-warning-light text-warning"}`, children: settlementStatus }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 font-bold text-secondary", children: /* @__PURE__ */ jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-primary/10 text-primary", children: withdrawalStatus }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5", children: isCompleted ? /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center px-2 py-0.5 bg-success-light text-success rounded-full text-[10px] font-extrabold uppercase", children: [
              /* @__PURE__ */ jsx(FiCheckCircle, { className: "mr-1" }),
              " COMPLETED"
            ] }) : /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center px-2 py-0.5 bg-warning-light text-warning rounded-full text-[10px] font-extrabold uppercase", children: [
              /* @__PURE__ */ jsx(FiClock, { className: "mr-1" }),
              " PENDING"
            ] }) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 text-neutral-400 whitespace-nowrap", children: fmtDate(txn.createdAt) }),
            /* @__PURE__ */ jsx("td", { className: "p-3.5 text-right whitespace-nowrap", children: /* @__PURE__ */ jsxs(
              "button",
              {
                onClick: () => openInvestigationDrawer("provider_earning", txn._id, txn),
                className: "inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm",
                children: [
                  /* @__PURE__ */ jsx(FiEye, { className: "mr-1.5" }),
                  " View Details"
                ]
              }
            ) })
          ] }, txn._id);
        }) })
      ] }) }),
      totalPages > 1 && /* @__PURE__ */ jsx("div", { className: "border-t border-neutral-100 flex justify-end", children: /* @__PURE__ */ jsx(
        Pagination,
        {
          currentPage,
          totalPages,
          totalItems,
          limit,
          onPageChange
        }
      ) })
    ] })
  ] });
};
export default ProviderEarningsPage;
