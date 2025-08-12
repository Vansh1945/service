import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Snackbar,
  Alert,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { Download, Visibility, Close } from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';

const UserInvoicesPage = () => {
  const { API, token, logoutUser, isAuthenticated, showToast } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch user invoices
  const fetchUserInvoices = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/invoice/user/my-invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setInvoices(response.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setError(err.response?.data?.message || 'Failed to fetch invoices');
      setLoading(false);
      if (err.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        logoutUser();
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserInvoices();
    }
  }, [isAuthenticated, token]);

  // View invoice details
  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setOpenDialog(true);
  };

  // Download invoice PDF
  const handleDownloadInvoice = async (invoiceId, invoiceNumber) => {
    try {
      setSnackbarMessage('Preparing download...');
      setSnackbarSeverity('info');
      setOpenSnackbar(true);

      const response = await axios.get(`${API}/invoice/${invoiceId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSnackbarMessage('Download started successfully!');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (err) {
      console.error('Failed to download invoice:', err);
      setSnackbarMessage(err.response?.data?.message || 'Failed to download invoice');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedInvoice(null);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  // InvoiceDetail Component
  const InvoiceDetail = ({ invoice }) => {
    return (
      <Box>
        {/* Header */}
        <Grid container justifyContent="space-between" alignItems="center" mb={3}>
          <Grid item>
            <Typography variant="h5" gutterBottom>
              Invoice #{invoice.invoiceNo}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Date: {formatDate(invoice.createdAt)}
            </Typography>
            {invoice.dueDate && (
              <Typography variant="body2" color="textSecondary">
                Due Date: {formatDate(invoice.dueDate)}
              </Typography>
            )}
          </Grid>
          <Grid item>
            <Chip 
              label={invoice.paymentStatus.toUpperCase()}
              color={
                invoice.paymentStatus === 'paid' ? 'success' : 
                invoice.paymentStatus === 'pending' ? 'warning' : 
                'error'
              }
              variant="outlined"
              size="medium"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Customer and Provider Info */}
        <Grid container spacing={4} mb={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Customer Information
            </Typography>
            <Typography variant="body1">
              {invoice.customer?.name || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {invoice.customer?.email || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {invoice.customer?.phone || 'N/A'}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Provider Information
            </Typography>
            <Typography variant="body1">
              {invoice.provider?.name || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {invoice.provider?.email || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {invoice.provider?.phone || 'N/A'}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Service Details */}
        <Typography variant="subtitle1" gutterBottom>
          Service Details
        </Typography>
        <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
          <Typography variant="body1" gutterBottom>
            {invoice.service?.title || 'N/A'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {invoice.service?.description || 'No description available'}
          </Typography>
          <Typography variant="body1" align="right" mt={2}>
            Service Amount: {formatCurrency(invoice.serviceAmount)}
          </Typography>
        </Paper>

        {/* Products Used */}
        {invoice.productsUsed && invoice.productsUsed.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Products Used
            </Typography>
            <List dense>
              {invoice.productsUsed.map((product, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={product.name}
                    secondary={`${product.quantity} x ${formatCurrency(product.rate)}`}
                  />
                  <Typography variant="body1">
                    {formatCurrency(product.total)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Summary */}
        <Grid container justifyContent="flex-end" spacing={2}>
          <Grid item xs={12} md={4}>
            <List>
              {invoice.discount > 0 && (
                <ListItem>
                  <ListItemText primary="Discount" />
                  <Typography variant="body1">
                    -{formatCurrency(invoice.discount)}
                  </Typography>
                </ListItem>
              )}
              {invoice.tax > 0 && (
                <ListItem>
                  <ListItemText primary="Tax" />
                  <Typography variant="body1">
                    {formatCurrency(invoice.tax)}
                  </Typography>
                </ListItem>
              )}
              <ListItem>
                <ListItemText primary="Total Amount" />
                <Typography variant="h6">
                  {formatCurrency(invoice.totalAmount)}
                </Typography>
              </ListItem>
            </List>
          </Grid>
        </Grid>

        {/* Payment Details */}
        {invoice.paymentDetails && invoice.paymentDetails.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              Payment Details
            </Typography>
            <List dense>
              {invoice.paymentDetails.map((payment, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`${payment.method.toUpperCase()} - ${payment.status.toUpperCase()}`}
                    secondary={formatDate(payment.date)}
                  />
                  <Typography variant="body1">
                    {formatCurrency(payment.amount)}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        My Invoices
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography color="error">{error}</Typography>
        </Box>
      ) : invoices.length === 0 ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography variant="h6">No invoices found</Typography>
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice._id}>
                    <TableCell>{invoice.invoiceNo}</TableCell>
                    <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                    <TableCell>{invoice.provider?.name || 'N/A'}</TableCell>
                    <TableCell>{invoice.service?.title || 'N/A'}</TableCell>
                    <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell>
                      <Typography 
                        color={
                          invoice.paymentStatus === 'paid' ? 'success.main' : 
                          invoice.paymentStatus === 'pending' ? 'warning.main' : 
                          'error.main'
                        }
                      >
                        {invoice.paymentStatus.charAt(0).toUpperCase() + invoice.paymentStatus.slice(1)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        color="primary" 
                        onClick={() => handleViewInvoice(invoice)}
                        aria-label="view invoice"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton 
                        color="secondary" 
                        onClick={() => handleDownloadInvoice(invoice._id, invoice.invoiceNo)}
                        aria-label="download invoice"
                      >
                        <Download />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Invoice Detail Dialog */}
          <Dialog 
            open={openDialog} 
            onClose={handleCloseDialog}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Invoice Details
              <IconButton
                aria-label="close"
                onClick={handleCloseDialog}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  color: (theme) => theme.palette.grey[500],
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {selectedInvoice && <InvoiceDetail invoice={selectedInvoice} />}
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={handleCloseDialog}
                variant="outlined"
              >
                Close
              </Button>
              <Button 
                onClick={() => {
                  if (selectedInvoice) {
                    handleDownloadInvoice(selectedInvoice._id, selectedInvoice.invoiceNo);
                  }
                }}
                variant="contained"
                color="primary"
                startIcon={<Download />}
              >
                Download PDF
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default UserInvoicesPage;