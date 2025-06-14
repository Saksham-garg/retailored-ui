/* eslint-disable @next/next/no-img-element */
'use client';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { TabView, TabPanel } from 'primereact/tabview';
import { useState, useRef, useCallback, useEffect } from 'react';
import { JobOrderService } from '@/demo/service/job-order.service';
import { PendingPaymentsService } from '@/demo/service/pending-transactions.service';
import { useInfiniteObserver } from '@/demo/hooks/useInfiniteObserver';
import { useDebounce } from 'use-debounce';
import { Toast } from '@capacitor/toast';

interface PendingPayment {
  id: string;
  amt_paid: number;
  amt_due: number;
  jobOrderDetails?: {
    adminSite: {
      sitename: string;
      code: number;
    };
  }[];
  user?: {
    id: string;
    fname: string;
    adminsite_code: number;
  };
}

interface Customer {
  id: string;
  name: string;
  mobile: string;
  type: 'receipt' | 'payment';
}

const PendingPayments = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 1000);
  const [isMaximized, setIsMaximized] = useState(true);
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<PendingPayment | null>(null);
  const [paymentModes, setPaymentModes] = useState<{id: string, mode_name: string}[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    reference: '',
    paymentMethod: null
  });

  const [receipts, setReceipts] = useState<PendingPayment[]>([]);
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [apiError, setApiError] = useState(false);
  const observerTarget = useRef(null);

  const fetchData = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setApiError(false);
      }
  
      const page = isLoadMore ? currentPage + 1 : 1;
      
      if (activeTab === 0) {
        const response = await PendingPaymentsService.getPendingReceipts(
          20,
          page,
          debouncedSearchTerm || null
        );
        
        if (isLoadMore) {
          setReceipts(prev => [...prev, ...response.data]);
        } else {
          setReceipts(response.data);
        }
        
        const receiptCustomers = response.data.map(item => ({
          id: item.user?.id || item.id,
          name: item.user?.fname || 'Unknown User',
          mobile: '9112345679',
          type: 'receipt' as const
        }));
        
        if (isLoadMore) {
          setCustomers(prev => [...prev, ...receiptCustomers]);
        } else {
          setCustomers(receiptCustomers);
        }
  
        setHasMorePages(response.pagination.hasMorePages);
        setCurrentPage(response.pagination.currentPage);
      } else {
        const response = await PendingPaymentsService.getPendingPayments(
          20,
          page,
          searchTerm || null
        );
        
        if (isLoadMore) {
          setPayments(prev => [...prev, ...response.data]);
        } else {
          setPayments(response.data);
        }
        
        const paymentCustomers = response.data.map(item => ({
          id: item.id,
          name: (item.jobOrderDetails?.[0]?.adminSite.sitename || 'Unknown'),
          mobile: '+91 0000000000',
          type: 'payment' as const
        }));
        
        if (isLoadMore) {
          setCustomers(prev => [...prev, ...paymentCustomers]);
        } else {
          setCustomers(paymentCustomers);
        }
  
        setHasMorePages(response.pagination.hasMorePages);
        setCurrentPage(response.pagination.currentPage);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setApiError(true);
      await Toast.show({
        text: 'Failed to fetch data',
        duration: 'short',
        position: 'bottom'
      });
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [activeTab, debouncedSearchTerm, currentPage]);

  useInfiniteObserver({
    targetRef: observerTarget,
    hasMorePages,
    isLoading: isLoadingMore,
    onIntersect: () => {
      if (hasMorePages && !apiError) {
        fetchData(true);
      }
    },
    deps: [hasMorePages, searchTerm, activeTab, apiError]
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, debouncedSearchTerm]);

  useEffect(() => {
    setSearchTerm('');
    setCurrentPage(1);
  }, [activeTab]);

  const fetchPaymentModes = useCallback(async () => {
    try {
      const modes = await JobOrderService.getPaymentModes();
      setPaymentModes(modes);
    } catch (error) {
      console.error('Error fetching payment modes:', error);
      await Toast.show({
        text: 'Failed to fetch payment methods',
        duration: 'short',
        position: 'bottom'
      });
    }
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(value);
  };

  const getCustomerPayments = (customerId: string, type: 'receipt' | 'payment') => {
    if (type === 'receipt') {
      return receipts.filter(payment => payment.user?.id === customerId || payment.id === customerId);
    } else {
      return payments.filter(payment => payment.id === customerId);
    }
  };

  const getTotalPending = (customerId: string, type: 'receipt' | 'payment') => {
    const items = type === 'receipt' ? receipts : payments;
    return items
      .filter(payment => payment.user?.id === customerId || payment.id === customerId)
      .reduce((sum, payment) => sum + payment.amt_due, 0);
  };

  const getSeverity = (amountPaid: number, amountDue: number) => {
    if (amountPaid === 0) return 'danger';
    if (amountPaid < amountDue) return 'warning';
    return 'success';
  };

  const getOverdueCount = (customerId: string, type: 'receipt' | 'payment') => {
    const items = type === 'receipt' ? receipts : payments;
    return items.filter(p => 
      (p.user?.id === customerId || p.id === customerId) && 
      p.amt_paid === 0
    ).length;
  };
  
  const renderCustomerCards = (type: 'receipt' | 'payment') => {
    return (
      <div className="flex flex-wrap gap-3 lg:justify-content-start">
        {customers
          .filter(customer => customer.type === type)
          .map((customer) => {
            const customerPayments = getCustomerPayments(customer.id, type);
            const totalPending = getTotalPending(customer.id, type);
            const overdueCount = getOverdueCount(customer.id, type);

            if (customerPayments.length === 0) return null;

            return (
              <Card
                key={`${customer.id}-${type}`}
                className="flex flex-column w-full sm:w-20rem lg:w-22rem shadow-1 hover:shadow-3 transition-shadow transition-duration-150"
              >
                <div className="flex justify-content-between align-items-start mb-3">
                  <div>
                    <h3 className="text-xl m-0">{customer.name}</h3>
                    <p className="text-sm text-500 mt-1">{customer.mobile}</p>
                  </div>
                  <Tag
                    value={formatCurrency(totalPending)}
                    severity="warning"
                    className="align-self-start"
                  />
                </div>

                <div className="flex flex-column gap-2 mb-3">
                  <div className="flex justify-content-between">
                    <span className="text-500">Pending {type === 'receipt' ? 'Receipts' : 'Payments'}:</span>
                    <span>{customerPayments.length}</span>
                  </div>
                  <div className="flex justify-content-between">
                    <span className="text-500">Overdue:</span>
                    <span>{overdueCount}</span>
                  </div>
                </div>

                <Button
                  label="View Details"
                  icon="pi pi-eye"
                  onClick={() => openDetailsDialog(customer)}
                  className="w-full p-button-sm"
                />
              </Card>
            );
          })}
        {customers.filter(customer => 
          customer.type === type && getCustomerPayments(customer.id, type).length > 0
        ).length === 0 && (
          <div className="w-full text-center py-5">
            <i className="pi pi-inbox text-4xl text-400 mb-2" />
            <p className="text-500">No {type === 'receipt' ? 'receipts' : 'payments'} found</p>
          </div>
        )}
        <div ref={observerTarget} className="w-full h-1rem" />
        {isLoadingMore && (
          <div className="w-full text-center py-3">
            <i className="pi pi-spinner pi-spin text-xl" />
          </div>
        )}
      </div>
    );
  };

  const openDetailsDialog = async (customer: Customer) => {
    await fetchPaymentModes();
    setSelectedCustomer(customer);
    setDetailsDialogVisible(true);
  };

  const openPaymentDialog = (payment: PendingPayment) => {
    setSelectedPaymentForRecord(payment);
      setPaymentForm({
      amount: payment.amt_due.toString(),
      paymentDate: new Date().toISOString().split('T')[0],
      reference: '',
      paymentMethod: null
    });
    setPaymentDialogVisible(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPaymentForRecord || !paymentForm.paymentMethod) {
      return;
    }

    const amountNum = Number(paymentForm.amount);
    if (amountNum > selectedPaymentForRecord.amt_due) {
      await Toast.show({
        text: `Amount cannot exceed ${formatCurrency(selectedPaymentForRecord.amt_due)}`,
        duration: 'short',
        position: 'bottom'
      });
      return;
    }

    try {
      const paymentData = {
        payment_date: paymentForm.paymentDate,
        payment_mode: paymentForm.paymentMethod,
        payment_ref: paymentForm.reference || null,
        payment_amt: Number(paymentForm.amount),
      };

      if (activeTab === 0) {
        if (!selectedPaymentForRecord.user) {
          throw new Error('User information missing for receipt payment');
        }

        await JobOrderService.createPaymentMain({
          ...paymentData,
          user_id: Number(selectedPaymentForRecord.user.id),
          order_id: Number(selectedPaymentForRecord.id),
          admsite_code: selectedPaymentForRecord.user.adminsite_code,
        });

        await Toast.show({
          text: 'Payment received successfully',
          duration: 'short',
          position: 'bottom'
        });
      } else {
        if (!selectedPaymentForRecord.jobOrderDetails?.[0]?.adminSite?.code) {
          throw new Error('Job order site information missing');
        }

        const adminSiteCode = selectedPaymentForRecord.jobOrderDetails[0].adminSite.code;

        await JobOrderService.createPaymentMain({
          ...paymentData,
          user_id: null,
          job_order_id: Number(selectedPaymentForRecord.id),
          admsite_code: Number(adminSiteCode),
        });

        await Toast.show({
          text: 'Payment recorded successfully',
          duration: 'short',
          position: 'bottom'
        });
      }

      fetchData();
      setPaymentDialogVisible(false);
      setDetailsDialogVisible(false);
      setPaymentForm({
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        reference: '',
        paymentMethod: null
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process payment';
      await Toast.show({
        text: errorMessage,
        duration: 'short',
        position: 'bottom'
      });
      console.error('Error:', err);
    }
  };

  return (
    <div className="flex flex-column p-3 lg:p-0" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
        <h2 className="text-2xl m-0">Pending Transactions</h2>
         <span className="p-input-icon-left p-input-icon-right w-full">
          <i className="pi pi-search" />
          <InputText 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search"
            className="w-full"
          />

          {isLoading && debouncedSearchTerm ? (
            <i className="pi pi-spin pi-spinner" />
          ) : searchTerm ? (
            <i 
              className="pi pi-times cursor-pointer" 
              onClick={() => {
                setSearchTerm('');
              }}
            />
          ) : null}
        </span>
      </div>

      <TabView 
        activeIndex={activeTab} 
        onTabChange={(e) => {
          setActiveTab(e.index);
          setCurrentPage(1);
          setHasMorePages(true);
        }}
        className="custom-tabview"
      >
        <TabPanel 
          header="Receipts" 
          headerClassName="w-6"
          contentClassName="pt-3"
        >
          {isLoading && !isLoadingMore ? (
            <div className="w-full text-center py-5">
              <i className="pi pi-spinner pi-spin text-4xl" />
            </div>
          ) : (
            renderCustomerCards('receipt')
          )}
        </TabPanel>
        <TabPanel 
          header="Payments" 
          headerClassName="w-6"
          contentClassName="pt-3"
        >
          {isLoading && !isLoadingMore ? (
            <div className="w-full text-center py-5">
              <i className="pi pi-spinner pi-spin text-4xl" />
            </div>
          ) : (
            renderCustomerCards('payment')
          )}
        </TabPanel>
      </TabView>

      <Dialog
        header={selectedCustomer ? `${selectedCustomer.name}'s ${activeTab === 0 ? 'Payment' : 'Receipt'} Details` : 'Details'}
        visible={detailsDialogVisible}
        onHide={() => setDetailsDialogVisible(false)}
        maximized={isMaximized}
        onMaximize={(e) => setIsMaximized(e.maximized)}
        className={isMaximized ? 'maximized-dialog' : ''}
        blockScroll
      >
        {selectedCustomer && (
          <>
            <div className="flex justify-content-between align-items-center my-4">
              <div className="font-medium text-xl">{selectedCustomer.name}</div>
              <Tag
                value={`${activeTab === 0 ? 'Receipts' : 'Payments'}: ${formatCurrency(
                  getTotalPending(selectedCustomer.id, activeTab === 0 ? 'receipt' : 'payment')
                )}`}
                severity={activeTab === 0 ? 'warning' : 'info'}
              />
            </div>

            <div className="flex flex-column gap-3 mb-4">
              {getCustomerPayments(selectedCustomer.id, activeTab === 0 ? 'receipt' : 'payment').length > 0 ? (
                getCustomerPayments(selectedCustomer.id, activeTab === 0 ? 'receipt' : 'payment').map((payment) => (
                  <Card key={payment.id} className="mb-2 shadow-2">
                    <div className="flex justify-content-between mb-2">
                      <span className="font-medium">ID:</span>
                      <span>{payment.id}</span>
                    </div>
                    {activeTab === 0 && payment.user && (
                      <div className="flex justify-content-between mb-2">
                        <span className="font-medium">User:</span>
                        <span>{payment.user.fname}</span>
                      </div>
                    )}
                    {activeTab === 1 && payment.jobOrderDetails?.[0]?.adminSite && (
                      <div className="flex justify-content-between mb-2">
                        <span className="font-medium">Jobber:</span>
                        <span>{payment.jobOrderDetails[0].adminSite.sitename}</span>
                      </div>
                    )}
                    <div className="flex justify-content-between mb-2">
                      <span className="font-medium">Amount Paid:</span>
                      <span>{formatCurrency(payment.amt_paid)}</span>
                    </div>
                    <div className="flex justify-content-between mb-3">
                      <span className="font-medium">Amount Due:</span>
                      <span>{formatCurrency(payment.amt_due)}</span>
                    </div>
                    <div className="flex justify-content-between mb-3">
                      <span className="font-medium">Status:</span>
                      <Tag
                        value={payment.amt_paid === 0 ? 'UNPAID' : payment.amt_paid < payment.amt_due ? 'PARTIAL' : 'PAID'}
                        severity={getSeverity(payment.amt_paid, payment.amt_due)}
                      />
                    </div>
                    <Button
                      label={activeTab === 0 ? 'Receive Payment' : 'Record Payment'}
                      icon="pi pi-money-bill"
                      onClick={() => openPaymentDialog(payment)}
                      className="w-full p-button-sm"
                      severity="success"
                    />
                  </Card>
                ))
              ) : (
                <div className="text-center py-3 text-500">
                  No {activeTab === 0 ? 'payment' : 'receipt'} records found
                </div>
              )}
            </div>
          </>
        )}
      </Dialog>

      <Dialog 
        header={`${activeTab === 0 ? 'Receive' : 'Record'} Payment`}
        visible={paymentDialogVisible}
        onHide={() => setPaymentDialogVisible(false)}
        maximized={isMaximized}
        onMaximize={(e) => setIsMaximized(e.maximized)}
        className={isMaximized ? 'maximized-dialog' : ''}
        blockScroll
      >
        {selectedPaymentForRecord && (
          <div className="p-fluid">
            <div className="my-4 p-3 border-round border-1 surface-border">
              <div className="flex justify-content-between mb-2">
                <span className="font-medium">Customer:</span>
                <span>{selectedCustomer?.name}</span>
              </div>
              <div className="flex justify-content-between">
                <span className="font-medium">Pending Amount:</span>
                <span className="font-bold">{formatCurrency(selectedPaymentForRecord.amt_due)}</span>
              </div>
            </div>

            <div className="field my-4">
              <label htmlFor="amount" className="font-bold block mb-2">
                Payment Amount (₹)
              </label>
              <InputText 
                id="amount" 
                type="number" 
                className="w-full" 
                placeholder="Enter amount"
                value={paymentForm.amount}
                onChange={(e) => {
                  const enteredAmount = parseFloat(e.target.value) || 0;
                  const maxAllowed = selectedPaymentForRecord?.amt_due || 0;
                  
                  if (enteredAmount <= maxAllowed) {
                    setPaymentForm({...paymentForm, amount: e.target.value});
                  } else {
                    Toast.show({
                      text: `Amount cannot exceed ${formatCurrency(maxAllowed)}`,
                      duration: 'short',
                      position: 'bottom'
                    });
                    setPaymentForm({...paymentForm, amount: maxAllowed.toString()});
                  }
                }}
                max={selectedPaymentForRecord?.amt_due}
              />
            </div>

            <div className="field mb-4">
              <label htmlFor="paymentDate" className="font-bold block mb-2">
                Payment Date
              </label>
              <InputText 
                id="paymentDate"
                type="date" 
                className="w-full" 
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
              />
            </div>

            <div className="field mb-4">
              <label htmlFor="paymentMethod" className="font-bold block mb-2">
                Payment Method
              </label>
              <Dropdown 
                id="paymentMethod"
                value={paymentForm.paymentMethod}
                options={paymentModes.map(mode => ({
                  label: mode.mode_name,
                  value: mode.id
                }))}
                optionLabel="label"
                placeholder="Select payment method"
                className="w-full"
                onChange={(e) => setPaymentForm({...paymentForm, paymentMethod: e.value})}
              />
            </div>

            <div className="field mb-4">
              <label htmlFor="reference" className="font-bold block mb-2">
                Reference/Note
              </label>
              <InputText 
                id="reference" 
                className="w-full" 
                placeholder="Enter reference or note"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({...paymentForm, reference: e.target.value})}
              />
            </div>

            <div className="flex justify-content-end gap-2 mt-4">
              <Button 
                label="Cancel" 
                icon="pi pi-times" 
                className="p-button-secondary"
                onClick={() => setPaymentDialogVisible(false)}
              />
              <Button 
                label={activeTab === 0 ? 'Receive Payment' : 'Record Payment'} 
                icon="pi pi-check" 
                className="p-button-success"
                onClick={handlePaymentSubmit}
                disabled={
                  !paymentForm.amount || 
                  !paymentForm.paymentDate || 
                  !paymentForm.paymentMethod ||
                  parseFloat(paymentForm.amount) > (selectedPaymentForRecord?.amt_due || 0) ||
                  parseFloat(paymentForm.amount) <= 0
                }
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default PendingPayments;