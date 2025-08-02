import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/auth';
import { DataGrid } from '@mui/x-data-grid';
import { 
  Button, 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Snackbar, 
  Alert, 
  IconButton, 
  Tooltip 
} from '@mui/material';
import { Download, Edit, Save, Cancel, CloudDownload } from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import moment from 'moment';

const AdminInvoice = () => {
  const { token, API, logoutUser, showToast } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [selectedRows, setSelectedRows] = useState([]);
  const [downloadAllLoading, setDownloadAllLoading] = useState(false);

  // Fetch all invoices
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/invoice`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logoutUser();
          return;
        }
        throw new Error('Failed to fetch invoices');
      }
      
      const data = await response.json();
      setInvoices(data.data);
      setLoading(false);
    } catch (error) {
      showToast(error.message, 'error');
      setLoading(false);
    }
  }, [token, API, logoutUser, showToast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Columns for DataGrid
  const columns = [
    { 
      field: 'invoiceNo', 
      headerName: 'Invoice #', 
      width: 150,
      renderCell: (params) => (
        <strong style={{ color: '#1976d2' }}>{params.value}</strong>
      )
    },
    { 
      field: 'customer', 
      headerName: 'Customer', 
      width: 200,
      valueGetter: (params) => params.row.customer?.name || 'N/A'
    },
    { 
      field: 'provider', 
      headerName: 'Provider', 
      width: 200,
      valueGetter: (params) => params.row.provider?.name || 'N/A'
    },
    { 
      field: 'service', 
      headerName: 'Service', 
      width: 180,
      valueGetter: (params) => params.row.service?.title || 'N/A'
    },
    { 
      field: 'totalAmount', 
      headerName: 'Amount', 
      width: 120,
      type: 'number',
      valueFormatter: (params) => `₹${params.value.toFixed(2)}`
    },
    { 
      field: 'paymentStatus', 
      headerName: 'Status', 
      width: 130,
      renderCell: (params) => {
        const status = params.value;
        let color;
        
        switch(status) {
          case 'paid':
            color = '#4caf50';
            break;
          case 'pending':
            color = '#ff9800';
            break;
          case 'failed':
            color = '#f44336';
            break;
          case 'partially_paid':
            color = '#2196f3';
            break;
          default:
            color = '#757575';
        }
        
        return (
          <span style={{ 
            color,
            textTransform: 'capitalize',
            fontWeight: 500
          }}>
            {status.replace('_', ' ')}
          </span>
        );
      }
    },
    { 
      field: 'generatedAt', 
      headerName: 'Date', 
      width: 150,
      type: 'date',
      valueGetter: (params) => new Date(params.value),
      valueFormatter: (params) => moment(params.value).format('DD MMM YYYY')
    },
    { 
      field: 'actions', 
      headerName: 'Actions', 
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit Invoice">
            <IconButton 
              onClick={() => handleEditClick(params.row)}
              color="primary"
              size="small"
              sx={{ '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.1)' } }}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Invoice">
            <IconButton 
              onClick={() => handleDownload(params.row._id)}
              color="secondary"
              size="small"
              sx={{ '&:hover': { backgroundColor: 'rgba(156, 39, 176, 0.1)' } }}
            >
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  // Handle edit button click
  const handleEditClick = (invoice) => {
    setSelectedInvoice(invoice);
    setEditForm({
      paymentStatus: invoice.paymentStatus,
      paidBy: invoice.paidBy,
      advancePayment: invoice.advancePayment,
      discount: invoice.discount,
      tax: invoice.tax
    });
    setEditDialogOpen(true);
  };

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save edited invoice
  const handleSave = async () => {
    try {
      const response = await fetch(`${API}/invoice/admin/${selectedInvoice._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update invoice');
      }
      
      const updatedInvoice = await response.json();
      
      // Update the local state
      setInvoices(prev => prev.map(inv => 
        inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
      ));
      
      setSnackbar({
        open: true,
        message: 'Invoice updated successfully!',
        severity: 'success'
      });
      setEditDialogOpen(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message,
        severity: 'error'
      });
    }
  };

  // Download single invoice
  const handleDownload = async (invoiceId) => {
    try {
      window.open(`${API}/invoice/${invoiceId}/download`, '_blank');
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to download invoice',
        severity: 'error'
      });
    }
  };

  // Download multiple invoices as PDF
  const handleDownloadSelected = async () => {
    if (selectedRows.length === 0) return;
    
    setDownloadAllLoading(true);
    
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.setTextColor(33, 33, 33);
      doc.text('Invoice Summary Report', 105, 20, { align: 'center' });
      
      // Add subtitle
      doc.setFontSize(12);
      doc.setTextColor(117, 117, 117);
      doc.text(`Generated on: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, 105, 30, { align: 'center' });
      
      // Add summary
      doc.text(`Total Invoices: ${selectedRows.length}`, 105, 40, { align: 'center' });
      
      // Prepare table data
      const tableData = selectedRows.map(row => [
        row.invoiceNo,
        row.customer?.name || 'N/A',
        row.provider?.name || 'N/A',
        `₹${row.totalAmount.toFixed(2)}`,
        row.paymentStatus.charAt(0).toUpperCase() + row.paymentStatus.slice(1).replace('_', ' '),
        moment(row.generatedAt).format('MMM D, YYYY')
      ]);
      
      // Add table
      autoTable(doc, {
        startY: 50,
        head: [['Invoice #', 'Customer', 'Provider', 'Amount', 'Status', 'Date']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: { 
          cellPadding: 5, 
          fontSize: 10,
          textColor: [33, 33, 33]
        },
        margin: { left: 10, right: 10 },
        columnStyles: {
          3: { cellWidth: 'auto', halign: 'right' }
        }
      });
      
      // Save the PDF
      doc.save(`invoices_report_${moment().format('YYYYMMDD_HHmmss')}.pdf`);
      
      setSnackbar({
        open: true,
        message: 'Downloaded selected invoices as PDF',
        severity: 'success'
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to generate PDF',
        severity: 'error'
      });
    } finally {
      setDownloadAllLoading(false);
    }
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ 
        p: 3,
        borderRadius: 2,
        boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)'
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ 
            fontWeight: 600,
            color: 'primary.main'
          }}>
            Invoice Management
          </Typography>
          
          {selectedRows.length > 0 && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<CloudDownload />}
              onClick={handleDownloadSelected}
              disabled={downloadAllLoading}
              sx={{
                textTransform: 'none',
                borderRadius: 1,
                px: 3,
                py: 1
              }}
            >
              {downloadAllLoading ? 'Preparing...' : `Download ${selectedRows.length} Selected`}
            </Button>
          )}
        </Box>
        
        <Box sx={{ 
          height: 600, 
          width: '100%',
          '& .MuiDataGrid-root': {
            border: 'none',
            fontFamily: 'inherit'
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#f5f5f5',
            fontWeight: 'bold'
          },
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #f0f0f0'
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.04)'
          }
        }}>
          <DataGrid
            rows={invoices}
            columns={columns}
            loading={loading}
            getRowId={(row) => row._id}
            checkboxSelection
            disableSelectionOnClick
            onSelectionModelChange={(ids) => {
              setSelectedRows(invoices.filter(invoice => ids.includes(invoice._id)));
            }}
            components={{
              NoRowsOverlay: () => (
                <Box 
                  display="flex" 
                  height="100%" 
                  alignItems="center" 
                  justifyContent="center"
                  flexDirection="column"
                  gap={1}
                >
                  <Typography variant="body1" color="text.secondary">
                    No invoices found
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => fetchInvoices()}
                  >
                    Refresh
                  </Button>
                </Box>
              ),
              LoadingOverlay: () => (
                <Box 
                  display="flex" 
                  height="100%" 
                  alignItems="center" 
                  justifyContent="center"
                  flexDirection="column"
                  gap={2}
                >
                  <CircularProgress size={24} />
                  <Typography variant="body1">
                    Loading invoices...
                  </Typography>
                </Box>
              )
            }}
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              },
              '& .MuiDataGrid-columnHeader:focus': {
                outline: 'none'
              }
            }}
          />
        </Box>
      </Paper>
      
      {/* Edit Invoice Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle sx={{ 
          backgroundColor: 'primary.main',
          color: 'white',
          fontWeight: 600
        }}>
          Edit Invoice #{selectedInvoice?.invoiceNo}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedInvoice && (
            <Box component="form" sx={{ mt: 1 }}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select
                  name="paymentStatus"
                  value={editForm.paymentStatus}
                  onChange={handleFormChange}
                  label="Payment Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="partially_paid">Partially Paid</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select
                  name="paidBy"
                  value={editForm.paidBy}
                  onChange={handleFormChange}
                  label="Payment Method"
                >
                  <MenuItem value="cod">Cash on Delivery</MenuItem>
                  <MenuItem value="online">Online Payment</MenuItem>
                  <MenuItem value="wallet">Wallet</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                fullWidth
                margin="normal"
                label="Advance Payment"
                name="advancePayment"
                type="number"
                value={editForm.advancePayment}
                onChange={handleFormChange}
                size="small"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                }}
              />
              
              <TextField
                fullWidth
                margin="normal"
                label="Discount"
                name="discount"
                type="number"
                value={editForm.discount}
                onChange={handleFormChange}
                size="small"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                }}
              />
              
              <TextField
                fullWidth
                margin="normal"
                label="Tax"
                name="tax"
                type="number"
                value={editForm.tax}
                onChange={handleFormChange}
                size="small"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setEditDialogOpen(false)} 
            startIcon={<Cancel />}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            color="primary" 
            startIcon={<Save />}
            variant="contained"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          sx={{ 
            width: '100%',
            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
            alignItems: 'center'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminInvoice;