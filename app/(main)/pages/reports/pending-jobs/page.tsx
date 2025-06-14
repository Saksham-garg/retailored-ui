/* eslint-disable @next/next/no-img-element */
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@capacitor/toast';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { Divider } from 'primereact/divider';
import { Skeleton } from 'primereact/skeleton';
import { useDebounce } from 'primereact/hooks';
import { ReportsService } from '@/demo/service/reports.service';
import { JobOrderService } from '@/demo/service/job-order.service';
import FullPageLoader from '@/demo/components/FullPageLoader';

interface PendingJobOrder {
  id: string;
  job_order_id: string;
  sales_order_id: string;
  jobberId: string;
  jobberName: string;
  job_date: string;
  productRef: string;
  statusId: string;
  status: string;
  making_charges: number;
  productId: string;
  productName: string;
  customerName: string;
}

interface PendingJobOrdersResponse {
  data: PendingJobOrder[];
  paginatorInfo: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    hasMorePages: boolean;
  };
}

const PendingJobOrderReport = () => {
  const router = useRouter();
  const [jobOrders, setJobOrders] = useState<PendingJobOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 1000);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    perPage: 10,
    total: 0,
    hasMorePages: true
  });
  const [statusSidebarVisible, setStatusSidebarVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingJobOrder | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastJobOrderRef = useRef<HTMLDivElement>(null);

  const availableStatuses = [
    { id: "1", name: 'Pending' },
    { id: "2", name: 'In Progress' },
    { id: "3", name: 'Completed' },
    { id: "4", name: 'Cancelled' }
  ];

  const fetchPendingJobOrders = useCallback(async (page: number, perPage: number, loadMore = false) => {
    try {
      if (loadMore) {
        setIsFetchingMore(true);
      } else {
        setLoading(true);
      }

      const response: PendingJobOrdersResponse = await ReportsService.getPendingJobOrders(
        debouncedSearchTerm,
        perPage,
        page
      );

      if (loadMore) {
        setJobOrders(prev => [...prev, ...response.data]);
      } else {
        setJobOrders(response.data);
      }

      setPagination({
        currentPage: response.paginatorInfo.currentPage,
        perPage: response.paginatorInfo.perPage,
        total: response.paginatorInfo.total,
        hasMorePages: response.paginatorInfo.hasMorePages
      });
    } catch (error) {
      console.error('Error fetching pending job orders:', error);
      await Toast.show({
        text: 'Failed to load pending job orders',
        duration: 'short',
        position: 'bottom'
      });
    } finally {
      if (loadMore) {
        setIsFetchingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    fetchPendingJobOrders(1, pagination.perPage);
  }, [fetchPendingJobOrders, pagination.perPage]);

  useEffect(() => {
    if (!pagination.hasMorePages || loading || isFetchingMore) return;

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        fetchPendingJobOrders(pagination.currentPage + 1, pagination.perPage, true);
      }
    };

    if (lastJobOrderRef.current) {
      observer.current = new IntersectionObserver(observerCallback, {
        root: null,
        rootMargin: '20px',
        threshold: 1.0
      });

      observer.current.observe(lastJobOrderRef.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [pagination, loading, isFetchingMore, fetchPendingJobOrders]);

  const getStatusSeverity = (status: string) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'In Progress': return 'info';
      case 'Pending': return 'warning';
      case 'Cancelled': return 'danger';
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleViewJO = (jobOrderId: string) => {
    router.push(`/pages/orders/job-order?id=${jobOrderId}&source=pending-jobs`);
  };

  const handleViewSO = (salesOrderId: string) => {
    router.push(`/pages/orders/sales-order?id=${salesOrderId}&source=pending-jobs`);
  };

  const openStatusChangeDialog = (item: PendingJobOrder) => {
    setSelectedItem(item);
    setSelectedStatus(item.statusId);
    setStatusSidebarVisible(true);
  };

  const handleStatusChange = async (statusId: string) => {
    if (!selectedItem) return;

    try {
      setIsSaving(true);
      
      await JobOrderService.updateJobOrderStatus(
        selectedItem.id,
         { 
          status_id: statusId ? parseInt(statusId) : null 
        }
      );

      await Toast.show({
        text: 'Status updated successfully',
        duration: 'short',
        position: 'bottom'
      });

      await fetchPendingJobOrders(1, pagination.perPage);
      setStatusSidebarVisible(false);
    } catch (error) {
      console.error('Error updating status:', error);
      await Toast.show({
        text: 'Failed to update status',
        duration: 'short',
        position: 'bottom'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !isFetchingMore && !debouncedSearchTerm) {
    return (
      <div className="flex flex-column p-3 lg:p-0" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3 w-full">
          <Skeleton width="10rem" height="2rem" />
          <Skeleton width="100%" height="2.5rem" className="md:w-20rem" />
        </div>
  
        <div className="grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="col-12 md:col-6 lg:col-4">
              <Card className="h-full">
                <div className="flex flex-column gap-2">
                  <div className="flex justify-content-between align-items-center">
                    <Skeleton width="8rem" height="1.25rem" />
                    <Skeleton width="5rem" height="1.25rem" />
                  </div>
  
                  <Divider className="my-2" />
  
                  <div className="flex flex-column gap-1">
                    <div className="flex justify-content-between">
                      <Skeleton width="6rem" height="1rem" />
                      <Skeleton width="7rem" height="1rem" />
                    </div>
                    <div className="flex justify-content-between">
                      <Skeleton width="6rem" height="1rem" />
                      <Skeleton width="7rem" height="1rem" />
                    </div>
                    <div className="flex justify-content-between">
                      <Skeleton width="6rem" height="1rem" />
                      <Skeleton width="7rem" height="1rem" />
                    </div>
                  </div>
  
                  <Divider className="my-2" />
  
                  <div className="flex gap-2">
                    <Skeleton width="100%" height="2rem" />
                    <Skeleton width="100%" height="2rem" />
                    <Skeleton width="100%" height="2rem" />
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-column p-3 lg:p-0" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {isSaving && <FullPageLoader />}
      
      <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
        <h2 className="text-2xl m-0">Pending Job Orders Report</h2>
        <span className="p-input-icon-left p-input-icon-right w-full">
          <i className="pi pi-search" />
          <InputText 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search"
            className="w-full"
          />

          {loading && debouncedSearchTerm ? (
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
      
      <div className="grid">
        {jobOrders.length > 0 ? (
          jobOrders.map((item, index) => (
            <div 
              key={`${item.job_order_id}-${item.id}`} 
              className="col-12 md:col-6 lg:col-4"
              ref={index === jobOrders.length - 1 ? lastJobOrderRef : null}
            >
              <Card className="h-full">
                <div className="flex flex-column gap-2">
                  <div className="flex justify-content-between align-items-center">
                    <span className="font-bold">{item.jobberName}</span>
                    <Tag 
                      value={item.status}
                      severity={getStatusSeverity(item.status)} 
                    />
                  </div>
                  
                  <Divider className="my-2" />
                  
                  <div className="flex flex-column gap-1">
                    <div className="flex justify-content-between">
                      <span className="text-600">Product:</span>
                      <span>{item.productName}</span>
                    </div>
                    <div className="flex justify-content-between">
                      <span className="text-600">Reference:</span>
                      <span>{item.productRef || '-'}</span>
                    </div>
                    <div className="flex justify-content-between">
                      <span className="text-600">Job Date:</span>
                      <span>{formatDate(item.job_date)}</span>
                    </div>
                    <div className="flex justify-content-between">
                      <span className="text-600">Making Charge:</span>
                      <span>{formatCurrency(item.making_charges)}</span>
                    </div>
                  </div>
                  
                  <Divider className="my-2" />
                  
                  <div className="flex flex-column gap-2 mt-3">
                    <Button 
                      label="View Job Order"
                      icon="pi pi-eye"
                      onClick={() => handleViewJO(item.job_order_id)}
                      className="w-full p-button-info"
                    />
                    
                    <Button 
                      label="Change Status"
                      icon="pi pi-cog"
                      onClick={() => openStatusChangeDialog(item)}
                      className="w-full p-button-secondary"
                    />
                    
                    <Button
                      label="View Sales Order"
                      icon="pi pi-eye"
                      onClick={() => handleViewSO(item.sales_order_id)}
                      className="w-full"
                    />
                  </div>
                </div>
              </Card>
            </div>
          ))
        ) : (
          <div className="col-12">
            <div className="p-4 text-center surface-100 border-round">
              <i className="pi pi-search text-3xl mb-1" />
              <h4>No pending job orders found</h4>
            </div>
          </div>
        )}
      </div>

      {isFetchingMore && (
        <div className="flex justify-content-center mt-3">
          <div className="flex align-items-center gap-2">
            <i className="pi pi-spinner pi-spin" />
            <span>Loading more job orders...</span>
          </div>
        </div>
      )}

      <Sidebar 
        visible={statusSidebarVisible} 
        onHide={() => setStatusSidebarVisible(false)}
        position="bottom"
        style={{ 
          width: '100%',
          height: 'auto',
          maxHeight: '62vh',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)'
        }}
        header={
          <div className="sticky top-0 bg-white z-1 p-3 border-bottom-1 surface-border flex justify-content-between align-items-center">
            <span className="font-bold text-xl">Update Job Order Status</span>
          </div>
        }
        className="p-0"
      >
        <div className="p-3">
          <div className="grid">
            {availableStatuses.map(status => (
              <div key={status.id} className="col-12 md:col-6 lg:col-4 p-2">
                <Button
                  label={status.name}
                  onClick={() => handleStatusChange(status.id)}
                  severity={getStatusSeverity(status.name) || undefined}
                  className="w-full p-3 text-lg justify-content-start p-button-outlined"
                  icon={
                    status.name === 'Completed' ? 'pi pi-check-circle' :
                    status.name === 'In Progress' ? 'pi pi-spinner' :
                    status.name === 'Pending' ? 'pi pi-clock' :
                    status.name === 'Cancelled' ? 'pi pi-times-circle' :
                    'pi pi-info-circle'
                  }
                  disabled={status.id === selectedItem?.statusId}
                />
              </div>
            ))}
          </div>
        </div>
      </Sidebar>
    </div>
  );
};

export default PendingJobOrderReport;