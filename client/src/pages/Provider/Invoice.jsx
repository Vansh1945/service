import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    CircularProgress,
    Avatar,
    TextField,
    MenuItem,
    Grid,
    Card,
    CardContent,
    Divider,
    IconButton,
    Tooltip,
    DialogContentText,
    FormControl,
    InputLabel,
    Select
} from '@mui/material';
import {
    Download as DownloadIcon,
    Receipt as ReceiptIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Close as CloseIcon,
    Paid as PaidIcon,
    Pending as PendingIcon,
    MoneyOff as MoneyOffIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const StatusChip = styled(Chip)(({ theme, status }) => ({
    fontWeight: 600,
    backgroundColor:
        status === 'paid'
            ? theme.palette.success.light
            : status === 'pending'
                ? theme.palette.warning.light
                : status === 'partially_paid'
                    ? theme.palette.info.light
                    : theme.palette.error.light,
    color: theme.palette.getContrastText(
        status === 'paid'
            ? theme.palette.success.light
            : status === 'pending'
                ? theme.palette.warning.light
                : status === 'partially_paid'
                    ? theme.palette.info.light
                    : theme.palette.error.light
    ),
}));

const PaymentMethodChip = styled(Chip)(({ theme }) => ({
    marginLeft: theme.spacing(1),
}));

const ProviderInvoicesPage = () => {
    const { token, API, showToast, logoutUser } = useAuth();
    const navigate = useNavigate();

    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openProductDialog, setOpenProductDialog] = useState(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [downloading, setDownloading] = useState(false);
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        quantity: 1,
        rate: 0,
        total: 0
    });

    // Fetch provider invoices
    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API}/invoice/provider/my-invoices`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
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
            } catch (error) {
                showToast(error.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchInvoices();
    }, [token, API, logoutUser, showToast]);

    // Handle product form changes
    const handleProductFormChange = (e) => {
        const { name, value } = e.target;
        setProductForm(prev => ({
            ...prev,
            [name]: value
        }));

        // Recalculate total when quantity or rate changes
        if (name === 'quantity' || name === 'rate') {
            const quantity = name === 'quantity' ? value : productForm.quantity;
            const rate = name === 'rate' ? value : productForm.rate;
            const total = (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);
            setProductForm(prev => ({
                ...prev,
                total: total.toFixed(2)
            }));
        }
    };

    // Open add product dialog
    const handleAddProduct = () => {
        setProductForm({
            name: '',
            description: '',
            quantity: 1,
            rate: 0,
            total: 0
        });
        setSelectedProduct(null);
        setOpenProductDialog(true);
    };

    // Open edit product dialog
    const handleEditProduct = (product) => {
        setProductForm({
            name: product.name,
            description: product.description,
            quantity: product.quantity,
            rate: product.rate,
            total: product.total
        });
        setSelectedProduct(product);
        setOpenProductDialog(true);
    };

    // Open delete product confirmation
    const handleDeleteProduct = (product) => {
        setSelectedProduct(product);
        setOpenDeleteDialog(true);
    };

    // Submit product form (add or edit)
    const handleSubmitProduct = async () => {
        try {
            const endpoint = selectedProduct
                ? `${API}/invoice/${selectedInvoice._id}/products/${selectedProduct._id}`
                : `${API}/invoice/${selectedInvoice._id}/products`;

            const method = selectedProduct ? 'PUT' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productForm)
            });

            if (!response.ok) {
                throw new Error(selectedProduct ? 'Failed to update product' : 'Failed to add product');
            }

            const updatedInvoice = await response.json();

            // Update the invoice in state
            setInvoices(prev => prev.map(inv =>
                inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
            ));

            // Update the selected invoice if it's the one being viewed
            if (selectedInvoice && selectedInvoice._id === updatedInvoice.data._id) {
                setSelectedInvoice(updatedInvoice.data);
            }

            showToast(selectedProduct ? 'Product updated successfully' : 'Product added successfully');
            setOpenProductDialog(false);
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    // Confirm product deletion
    const handleConfirmDelete = async () => {
        try {
            const response = await fetch(
                `${API}/invoice/${selectedInvoice._id}/products/${selectedProduct._id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete product');
            }

            const updatedInvoice = await response.json();

            // Update the invoice in state
            setInvoices(prev => prev.map(inv =>
                inv._id === updatedInvoice.data._id ? updatedInvoice.data : inv
            ));

            // Update the selected invoice if it's the one being viewed
            if (selectedInvoice && selectedInvoice._id === updatedInvoice.data._id) {
                setSelectedInvoice(updatedInvoice.data);
            }

            showToast('Product deleted successfully');
            setOpenDeleteDialog(false);
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    // Filter invoices based on search and filter
    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch =
            invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.service?.title.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
            filterStatus === 'all' ||
            invoice.paymentStatus === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Handle invoice download
    const handleDownloadInvoice = async (invoiceId) => {
        try {
            setDownloading(true);
            const response = await fetch(`${API}/invoice/${invoiceId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to download invoice');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            showToast('Invoice downloaded successfully');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setDownloading(false);
        }
    };

    // View invoice details
    const handleViewInvoice = (invoice) => {
        setSelectedInvoice(invoice);
        setOpenDialog(true);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                <ReceiptIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                My Invoices
            </Typography>

            {/* Search and Filter Bar */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder="Search invoices..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <TextField
                            select
                            fullWidth
                            label="Filter by status"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            variant="outlined"
                            InputProps={{
                                startAdornment: <FilterIcon sx={{ mr: 1, color: 'action.active' }} />,
                            }}
                        >
                            <MenuItem value="all">All Statuses</MenuItem>
                            <MenuItem value="paid">Paid</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="partially_paid">Partially Paid</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={() => navigate('/provider/bookings')}
                            sx={{ height: '56px' }}
                        >
                            View Bookings
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Invoices Table */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : filteredInvoices.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">
                        No invoices found
                    </Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'primary.main' }}>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Invoice #</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Customer</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Service</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Date</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Amount</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ color: 'common.white', fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredInvoices.map((invoice) => (
                                <TableRow key={invoice._id} hover>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {invoice.invoiceNo}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Avatar
                                                sx={{ width: 32, height: 32, mr: 1, bgcolor: 'primary.main' }}
                                                src={invoice.customer?.avatar}
                                            >
                                                {invoice.customer?.name?.charAt(0)}
                                            </Avatar>
                                            <Typography variant="body2">
                                                {invoice.customer?.name || 'N/A'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {invoice.service?.title || 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {format(new Date(invoice.generatedAt), 'dd MMM yyyy')}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            ₹{invoice.totalAmount?.toFixed(2) || '0.00'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <StatusChip
                                                size="small"
                                                status={invoice.paymentStatus}
                                                label={invoice.paymentStatus?.replace('_', ' ') || 'N/A'}
                                            />
                                            {invoice.paidBy && (
                                                <PaymentMethodChip
                                                    size="small"
                                                    label={invoice.paidBy}
                                                    icon={
                                                        invoice.paidBy === 'online' ? (
                                                            <PaidIcon fontSize="small" />
                                                        ) : invoice.paidBy === 'pending' ? (
                                                            <PendingIcon fontSize="small" />
                                                        ) : (
                                                            <MoneyOffIcon fontSize="small" />
                                                        )
                                                    }
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Tooltip title="View Details">
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => handleViewInvoice(invoice)}
                                                >
                                                    <ReceiptIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Download Invoice">
                                                <IconButton
                                                    size="small"
                                                    color="secondary"
                                                    onClick={() => handleDownloadInvoice(invoice._id)}
                                                    disabled={downloading}
                                                >
                                                    {downloading ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <DownloadIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Invoice Details Dialog */}
            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Invoice Details
                    </Typography>
                    <IconButton onClick={() => setOpenDialog(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedInvoice && (
                        <Box>
                            {/* Header */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                                <Box>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                        INVOICE
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        #{selectedInvoice.invoiceNo}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2">
                                        <strong>Date:</strong> {format(new Date(selectedInvoice.generatedAt), 'dd MMM yyyy')}
                                    </Typography>
                                    <Typography variant="body2">
                                        <strong>Due Date:</strong> {format(new Date(selectedInvoice.dueDate), 'dd MMM yyyy')}
                                    </Typography>
                                </Box>
                            </Box>

                            <Grid container spacing={3} sx={{ mb: 3 }}>
                                {/* Provider Info */}
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                                From:
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                {selectedInvoice.provider?.name || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.provider?.email || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.provider?.phone || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.provider?.address || 'N/A'}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>

                                {/* Customer Info */}
                                <Grid item xs={12} md={6}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                                To:
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                {selectedInvoice.customer?.name || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.customer?.email || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.customer?.phone || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {selectedInvoice.customer?.address || 'N/A'}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Service Details */}
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                Service Details
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }} align="right">Amount</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>
                                                <Typography sx={{ fontWeight: 600 }}>
                                                    {selectedInvoice.service?.title || 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" color="textSecondary">
                                                    {selectedInvoice.service?.description || 'No description'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                ₹{selectedInvoice.serviceAmount?.toFixed(2) || '0.00'}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Products Used Section */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    Products Used
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddProduct}
                                >
                                    Add Product
                                </Button>
                            </Box>

                            {selectedInvoice.productsUsed?.length > 0 ? (
                                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">Qty</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">Rate</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">Total</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {selectedInvoice.productsUsed.map((product, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <Typography sx={{ fontWeight: 500 }}>
                                                            {product.name}
                                                        </Typography>
                                                        {product.description && (
                                                            <Typography variant="body2" color="textSecondary">
                                                                {product.description}
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">{product.quantity}</TableCell>
                                                    <TableCell align="right">₹{product.rate?.toFixed(2)}</TableCell>
                                                    <TableCell align="right">₹{product.total?.toFixed(2)}</TableCell>
                                                    <TableCell align="right">
                                                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                            <Tooltip title="Edit">
                                                                <IconButton
                                                                    size="small"
                                                                    color="primary"
                                                                    onClick={() => handleEditProduct(product)}
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => handleDeleteProduct(product)}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                <Paper variant="outlined" sx={{ p: 2, mb: 3, textAlign: 'center' }}>
                                    <Typography color="textSecondary">
                                        No products added to this invoice
                                    </Typography>
                                </Paper>
                            )}

                            {/* Summary */}
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Paper variant="outlined" sx={{ p: 2, width: '100%', maxWidth: 400 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                        Summary
                                    </Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography>Service Amount:</Typography>
                                        <Typography>₹{selectedInvoice.serviceAmount?.toFixed(2) || '0.00'}</Typography>
                                    </Box>
                                    {selectedInvoice.productsUsed?.length > 0 && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography>Products Total:</Typography>
                                            <Typography>
                                                ₹{selectedInvoice.productsUsed.reduce((sum, p) => sum + (p.total || 0), 0).toFixed(2)}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography>Tax (18%):</Typography>
                                        <Typography>₹{selectedInvoice.tax?.toFixed(2) || '0.00'}</Typography>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography sx={{ fontWeight: 600 }}>Total Amount:</Typography>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            ₹{selectedInvoice.totalAmount?.toFixed(2) || '0.00'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography>Advance Paid:</Typography>
                                        <Typography>₹{selectedInvoice.advancePayment?.toFixed(2) || '0.00'}</Typography>
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontWeight: 600 }}>Balance Due:</Typography>
                                        <Typography sx={{ fontWeight: 600 }}>
                                            ₹{selectedInvoice.balanceDue?.toFixed(2) || '0.00'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Box>

                            {/* Commission Details (Provider View) */}
                            <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                    Commission Details
                                </Typography>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography>Commission Rate:</Typography>
                                    <Typography>
                                        {selectedInvoice.commissionDetails?.baseRate || 0}%
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography>Commission Amount:</Typography>
                                    <Typography>
                                        ₹{selectedInvoice.commissionAmount?.toFixed(2) || '0.00'}
                                    </Typography>
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontWeight: 600 }}>Net Amount:</Typography>
                                    <Typography sx={{ fontWeight: 600 }}>
                                        ₹{selectedInvoice.netAmount?.toFixed(2) || '0.00'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setOpenDialog(false)}
                        color="primary"
                        variant="outlined"
                    >
                        Close
                    </Button>
                    <Button
                        onClick={() => {
                            if (selectedInvoice) {
                                handleDownloadInvoice(selectedInvoice._id);
                            }
                        }}
                        color="primary"
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        disabled={downloading}
                    >
                        {downloading ? 'Downloading...' : 'Download Invoice'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Product Dialog */}
            <Dialog open={openProductDialog} onClose={() => setOpenProductDialog(false)}>
                <DialogTitle>
                    {selectedProduct ? 'Edit Product' : 'Add Product to Invoice'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Product Name"
                            name="name"
                            value={productForm.name}
                            onChange={handleProductFormChange}
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            name="description"
                            value={productForm.description}
                            onChange={handleProductFormChange}
                            margin="normal"
                            multiline
                            rows={3}
                        />
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Quantity"
                                    name="quantity"
                                    type="number"
                                    value={productForm.quantity}
                                    onChange={handleProductFormChange}
                                    margin="normal"
                                    required
                                    inputProps={{ min: 1 }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Rate (₹)"
                                    name="rate"
                                    type="number"
                                    value={productForm.rate}
                                    onChange={handleProductFormChange}
                                    margin="normal"
                                    required
                                    inputProps={{ min: 0, step: 0.01 }}
                                />
                            </Grid>
                        </Grid>
                        <TextField
                            fullWidth
                            label="Total (₹)"
                            name="total"
                            value={productForm.total}
                            margin="normal"
                            disabled
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenProductDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleSubmitProduct}
                        variant="contained"
                        color="primary"
                        disabled={!productForm.name || !productForm.quantity || !productForm.rate}
                    >
                        {selectedProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Product Confirmation Dialog */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                <DialogTitle>Delete Product</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the product "{selectedProduct?.name}"?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProviderInvoicesPage;




// import React, { useState, useEffect } from 'react';
// import { 
//   FileText, 
//   Download, 
//   Eye, 
//   Edit, 
//   Plus, 
//   Search, 
//   Filter, 
//   DollarSign, 
//   Calendar, 
//   User, 
//   Package, 
//   TrendingUp,
//   AlertCircle,
//   CheckCircle,
//   Clock,
//   RefreshCw,
//   IndianRupee,
//   ChevronDown,
//   X
// } from 'lucide-react';

// const ProviderInvoiceDashboard = () => {
//   const [invoices, setInvoices] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedInvoice, setSelectedInvoice] = useState(null);
//   const [showModal, setShowModal] = useState(false);
//   const [filter, setFilter] = useState('all');
//   const [searchTerm, setSearchTerm] = useState('');
//   const [sortBy, setSortBy] = useState('generatedAt');
//   const [sortOrder, setSortOrder] = useState('desc');

//   // Mock data for demonstration
//   const mockInvoices = [
//     {
//       _id: '1',
//       invoiceNo: 'INV-240114-143022',
//       customer: { name: 'John Doe', email: 'john@example.com', phone: '+91 98765 43210' },
//       service: { title: 'Home Cleaning Service' },
//       serviceAmount: 1500,
//       productsUsed: [
//         { name: 'Cleaning Spray', quantity: 2, rate: 150, total: 300 },
//         { name: 'Floor Cleaner', quantity: 1, rate: 200, total: 200 }
//       ],
//       tax: 306,
//       discount: 0,
//       totalAmount: 2006,
//       balanceDue: 2006,
//       advancePayment: 0,
//       paymentStatus: 'pending',
//       paidBy: 'pending',
//       generatedAt: '2024-01-14T08:30:22.000Z',
//       dueDate: '2024-01-21T08:30:22.000Z',
//       commissionAmount: 301,
//       netAmount: 1705,
//       commissionDetails: { baseRate: 15, baseType: 'percentage' }
//     },
//     {
//       _id: '2',
//       invoiceNo: 'INV-240113-101545',
//       customer: { name: 'Jane Smith', email: 'jane@example.com', phone: '+91 87654 32109' },
//       service: { title: 'Plumbing Service' },
//       serviceAmount: 2500,
//       productsUsed: [
//         { name: 'Pipe Fittings', quantity: 5, rate: 80, total: 400 },
//         { name: 'Sealant', quantity: 2, rate: 120, total: 240 }
//       ],
//       tax: 559.2,
//       discount: 100,
//       totalAmount: 3599.2,
//       balanceDue: 0,
//       advancePayment: 3599.2,
//       paymentStatus: 'paid',
//       paidBy: 'upi',
//       generatedAt: '2024-01-13T04:15:45.000Z',
//       dueDate: '2024-01-20T04:15:45.000Z',
//       commissionAmount: 539.88,
//       netAmount: 3059.32,
//       commissionDetails: { baseRate: 15, baseType: 'percentage' }
//     },
//     {
//       _id: '3',
//       invoiceNo: 'INV-240112-162030',
//       customer: { name: 'Mike Johnson', email: 'mike@example.com', phone: '+91 76543 21098' },
//       service: { title: 'Electrical Repair' },
//       serviceAmount: 800,
//       productsUsed: [],
//       tax: 144,
//       discount: 50,
//       totalAmount: 894,
//       balanceDue: 394,
//       advancePayment: 500,
//       paymentStatus: 'partially_paid',
//       paidBy: 'cash',
//       generatedAt: '2024-01-12T10:20:30.000Z',
//       dueDate: '2024-01-19T10:20:30.000Z',
//       commissionAmount: 134.1,
//       netAmount: 759.9,
//       commissionDetails: { baseRate: 15, baseType: 'percentage' }
//     }
//   ];

//   useEffect(() => {
//     // Simulate API call
//     setTimeout(() => {
//       setInvoices(mockInvoices);
//       setLoading(false);
//     }, 1000);
//   }, []);

//   const getStatusColor = (status) => {
//     switch (status) {
//       case 'paid': return 'bg-green-100 text-green-800';
//       case 'pending': return 'bg-yellow-100 text-yellow-800';
//       case 'partially_paid': return 'bg-blue-100 text-blue-800';
//       case 'failed': return 'bg-red-100 text-red-800';
//       default: return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const getStatusIcon = (status) => {
//     switch (status) {
//       case 'paid': return <CheckCircle className="w-4 h-4" />;
//       case 'pending': return <Clock className="w-4 h-4" />;
//       case 'partially_paid': return <AlertCircle className="w-4 h-4" />;
//       case 'failed': return <X className="w-4 h-4" />;
//       default: return <Clock className="w-4 h-4" />;
//     }
//   };

//   const formatDate = (dateString) => {
//     return new Date(dateString).toLocaleDateString('en-IN', {
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric'
//     });
//   };

//   const formatCurrency = (amount) => {
//     return new Intl.NumberFormat('en-IN', {
//       style: 'currency',
//       currency: 'INR'
//     }).format(amount);
//   };

//   const filteredInvoices = invoices.filter(invoice => {
//     const matchesFilter = filter === 'all' || invoice.paymentStatus === filter;
//     const matchesSearch = invoice.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
//                          invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//                          invoice.service.title.toLowerCase().includes(searchTerm.toLowerCase());
//     return matchesFilter && matchesSearch;
//   });

//   const sortedInvoices = [...filteredInvoices].sort((a, b) => {
//     const aValue = a[sortBy];
//     const bValue = b[sortBy];
    
//     if (sortOrder === 'desc') {
//       return new Date(bValue) - new Date(aValue);
//     } else {
//       return new Date(aValue) - new Date(bValue);
//     }
//   });

//   const totalEarnings = invoices.reduce((sum, invoice) => sum + invoice.netAmount, 0);
//   const pendingAmount = invoices.filter(inv => inv.paymentStatus === 'pending').reduce((sum, inv) => sum + inv.totalAmount, 0);
//   const paidAmount = invoices.filter(inv => inv.paymentStatus === 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0);
//   const commissionTotal = invoices.reduce((sum, invoice) => sum + invoice.commissionAmount, 0);

//   const handleDownload = (invoice) => {
//     // Simulate PDF download
//     const link = document.createElement('a');
//     link.href = '#';
//     link.download = `invoice_${invoice.invoiceNo}.pdf`;
//     link.click();
//   };

//   const handleViewInvoice = (invoice) => {
//     setSelectedInvoice(invoice);
//     setShowModal(true);
//   };

//   const handleUpdateInvoice = (invoice) => {
//     // Handle update logic
//     console.log('Update invoice:', invoice);
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="text-center">
//           <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
//           <p className="text-gray-600">Loading invoices...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white shadow-sm border-b">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex justify-between items-center py-6">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">Invoice Management</h1>
//               <p className="text-gray-600">Manage your service invoices and earnings</p>
//             </div>
//             <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
//               <Plus className="w-4 h-4" />
//               New Invoice
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Stats Cards */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm font-medium text-gray-600">Total Earnings</p>
//                 <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEarnings)}</p>
//               </div>
//               <div className="bg-green-100 p-3 rounded-full">
//                 <TrendingUp className="w-6 h-6 text-green-600" />
//               </div>
//             </div>
//           </div>

//           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm font-medium text-gray-600">Pending Amount</p>
//                 <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
//               </div>
//               <div className="bg-yellow-100 p-3 rounded-full">
//                 <Clock className="w-6 h-6 text-yellow-600" />
//               </div>
//             </div>
//           </div>

//           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm font-medium text-gray-600">Paid Amount</p>
//                 <p className="text-2xl font-bold text-blue-600">{formatCurrency(paidAmount)}</p>
//               </div>
//               <div className="bg-blue-100 p-3 rounded-full">
//                 <CheckCircle className="w-6 h-6 text-blue-600" />
//               </div>
//             </div>
//           </div>

//           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
//             <div className="flex items-center justify-between">
//               <div>
//                 <p className="text-sm font-medium text-gray-600">Commission Paid</p>
//                 <p className="text-2xl font-bold text-purple-600">{formatCurrency(commissionTotal)}</p>
//               </div>
//               <div className="bg-purple-100 p-3 rounded-full">
//                 <IndianRupee className="w-6 h-6 text-purple-600" />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Filters and Search */}
//         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
//           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
//             <div className="flex flex-col md:flex-row gap-4 items-center">
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <input
//                   type="text"
//                   placeholder="Search invoices..."
//                   className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                 />
//               </div>
              
//               <select
//                 className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 value={filter}
//                 onChange={(e) => setFilter(e.target.value)}
//               >
//                 <option value="all">All Status</option>
//                 <option value="pending">Pending</option>
//                 <option value="paid">Paid</option>
//                 <option value="partially_paid">Partially Paid</option>
//                 <option value="failed">Failed</option>
//               </select>
//             </div>

//             <div className="flex items-center gap-2">
//               <Filter className="w-4 h-4 text-gray-500" />
//               <select
//                 className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                 value={`${sortBy}_${sortOrder}`}
//                 onChange={(e) => {
//                   const [field, order] = e.target.value.split('_');
//                   setSortBy(field);
//                   setSortOrder(order);
//                 }}
//               >
//                 <option value="generatedAt_desc">Latest First</option>
//                 <option value="generatedAt_asc">Oldest First</option>
//                 <option value="totalAmount_desc">Amount High to Low</option>
//                 <option value="totalAmount_asc">Amount Low to High</option>
//               </select>
//             </div>
//           </div>
//         </div>

//         {/* Invoices Table */}
//         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Invoice Details
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Customer
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Service
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Amount
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Status
//                   </th>
//                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     Actions
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {sortedInvoices.map((invoice) => (
//                   <tr key={invoice._id} className="hover:bg-gray-50">
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div>
//                         <div className="text-sm font-medium text-gray-900">{invoice.invoiceNo}</div>
//                         <div className="text-sm text-gray-500">
//                           Generated: {formatDate(invoice.generatedAt)}
//                         </div>
//                         <div className="text-sm text-gray-500">
//                           Due: {formatDate(invoice.dueDate)}
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="flex items-center">
//                         <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
//                           <User className="w-5 h-5 text-blue-600" />
//                         </div>
//                         <div className="ml-3">
//                           <div className="text-sm font-medium text-gray-900">{invoice.customer.name}</div>
//                           <div className="text-sm text-gray-500">{invoice.customer.phone}</div>
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="text-sm text-gray-900">{invoice.service.title}</div>
//                       <div className="text-sm text-gray-500">
//                         {invoice.productsUsed.length} products used
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="text-sm text-gray-900 font-medium">
//                         {formatCurrency(invoice.totalAmount)}
//                       </div>
//                       <div className="text-sm text-gray-500">
//                         Net: {formatCurrency(invoice.netAmount)}
//                       </div>
//                       <div className="text-sm text-gray-500">
//                         Balance: {formatCurrency(invoice.balanceDue)}
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.paymentStatus)}`}>
//                         {getStatusIcon(invoice.paymentStatus)}
//                         {invoice.paymentStatus.replace('_', ' ')}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                       <div className="flex items-center gap-2">
//                         <button
//                           onClick={() => handleViewInvoice(invoice)}
//                           className="text-blue-600 hover:text-blue-900 p-1 rounded"
//                           title="View Invoice"
//                         >
//                           <Eye className="w-4 h-4" />
//                         </button>
//                         <button
//                           onClick={() => handleUpdateInvoice(invoice)}
//                           className="text-green-600 hover:text-green-900 p-1 rounded"
//                           title="Update Invoice"
//                         >
//                           <Edit className="w-4 h-4" />
//                         </button>
//                         <button
//                           onClick={() => handleDownload(invoice)}
//                           className="text-purple-600 hover:text-purple-900 p-1 rounded"
//                           title="Download PDF"
//                         >
//                           <Download className="w-4 h-4" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {sortedInvoices.length === 0 && (
//           <div className="text-center py-12">
//             <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//             <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
//             <p className="text-gray-500">Try adjusting your search or filter criteria</p>
//           </div>
//         )}
//       </div>

//       {/* Invoice Detail Modal */}
//       {showModal && selectedInvoice && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
//           <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
//             <div className="p-6 border-b border-gray-200">
//               <div className="flex justify-between items-center">
//                 <h2 className="text-xl font-semibold text-gray-900">
//                   Invoice Details - {selectedInvoice.invoiceNo}
//                 </h2>
//                 <button
//                   onClick={() => setShowModal(false)}
//                   className="text-gray-400 hover:text-gray-600"
//                 >
//                   <X className="w-6 h-6" />
//                 </button>
//               </div>
//             </div>

//             <div className="p-6">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 {/* Customer Info */}
//                 <div className="bg-gray-50 p-4 rounded-lg">
//                   <h3 className="font-medium text-gray-900 mb-3">Customer Information</h3>
//                   <div className="space-y-2">
//                     <p><span className="font-medium">Name:</span> {selectedInvoice.customer.name}</p>
//                     <p><span className="font-medium">Email:</span> {selectedInvoice.customer.email}</p>
//                     <p><span className="font-medium">Phone:</span> {selectedInvoice.customer.phone}</p>
//                   </div>
//                 </div>

//                 {/* Invoice Info */}
//                 <div className="bg-gray-50 p-4 rounded-lg">
//                   <h3 className="font-medium text-gray-900 mb-3">Invoice Information</h3>
//                   <div className="space-y-2">
//                     <p><span className="font-medium">Generated:</span> {formatDate(selectedInvoice.generatedAt)}</p>
//                     <p><span className="font-medium">Due Date:</span> {formatDate(selectedInvoice.dueDate)}</p>
//                     <p><span className="font-medium">Status:</span> 
//                       <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusColor(selectedInvoice.paymentStatus)}`}>
//                         {selectedInvoice.paymentStatus.replace('_', ' ')}
//                       </span>
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               {/* Service Details */}
//               <div className="mt-6 bg-gray-50 p-4 rounded-lg">
//                 <h3 className="font-medium text-gray-900 mb-3">Service Details</h3>
//                 <p><span className="font-medium">Service:</span> {selectedInvoice.service.title}</p>
//                 <p><span className="font-medium">Amount:</span> {formatCurrency(selectedInvoice.serviceAmount)}</p>
//               </div>

//               {/* Products Used */}
//               {selectedInvoice.productsUsed.length > 0 && (
//                 <div className="mt-6 bg-gray-50 p-4 rounded-lg">
//                   <h3 className="font-medium text-gray-900 mb-3">Products Used</h3>
//                   <div className="overflow-x-auto">
//                     <table className="w-full text-sm">
//                       <thead>
//                         <tr className="border-b border-gray-200">
//                           <th className="text-left py-2">Product</th>
//                           <th className="text-right py-2">Qty</th>
//                           <th className="text-right py-2">Rate</th>
//                           <th className="text-right py-2">Total</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {selectedInvoice.productsUsed.map((product, index) => (
//                           <tr key={index} className="border-b border-gray-100">
//                             <td className="py-2">{product.name}</td>
//                             <td className="py-2 text-right">{product.quantity}</td>
//                             <td className="py-2 text-right">{formatCurrency(product.rate)}</td>
//                             <td className="py-2 text-right">{formatCurrency(product.total)}</td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>
//               )}

//               {/* Amount Summary */}
//               <div className="mt-6 bg-gray-50 p-4 rounded-lg">
//                 <h3 className="font-medium text-gray-900 mb-3">Amount Summary</h3>
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Service Amount:</span>
//                     <span>{formatCurrency(selectedInvoice.serviceAmount)}</span>
//                   </div>
//                   {selectedInvoice.productsUsed.length > 0 && (
//                     <div className="flex justify-between">
//                       <span>Products Total:</span>
//                       <span>{formatCurrency(selectedInvoice.productsUsed.reduce((sum, p) => sum + p.total, 0))}</span>
//                     </div>
//                   )}
//                   <div className="flex justify-between">
//                     <span>Tax:</span>
//                     <span>{formatCurrency(selectedInvoice.tax)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Discount:</span>
//                     <span>-{formatCurrency(selectedInvoice.discount)}</span>
//                   </div>
//                   <hr className="my-2" />
//                   <div className="flex justify-between font-medium">
//                     <span>Total Amount:</span>
//                     <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Advance Paid:</span>
//                     <span>{formatCurrency(selectedInvoice.advancePayment)}</span>
//                   </div>
//                   <div className="flex justify-between font-medium">
//                     <span>Balance Due:</span>
//                     <span>{formatCurrency(selectedInvoice.balanceDue)}</span>
//                   </div>
//                 </div>
//               </div>

//               {/* Commission Details */}
//               <div className="mt-6 bg-blue-50 p-4 rounded-lg">
//                 <h3 className="font-medium text-gray-900 mb-3">Commission Details</h3>
//                 <div className="space-y-2">
//                   <div className="flex justify-between">
//                     <span>Commission Rate:</span>
//                     <span>{selectedInvoice.commissionDetails.baseRate}%</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span>Commission Amount:</span>
//                     <span>{formatCurrency(selectedInvoice.commissionAmount)}</span>
//                   </div>
//                   <div className="flex justify-between font-medium">
//                     <span>Net Amount (Your Earnings):</span>
//                     <span className="text-green-600">{formatCurrency(selectedInvoice.netAmount)}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
//               <button
//                 onClick={() => setShowModal(false)}
//                 className="px-4 py-2 text-gray-600 hover:text-gray-800"
//               >
//                 Close
//               </button>
//               <button
//                 onClick={() => handleDownload(selectedInvoice)}
//                 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
//               >
//                 <Download className="w-4 h-4" />
//                 Download PDF
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProviderInvoiceDashboard;