/* eslint-disable @next/next/no-img-element */
'use client';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { ToggleButton } from 'primereact/togglebutton';
import { useState, useEffect, useRef } from 'react';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Skeleton } from 'primereact/skeleton';
import { useDebounce } from 'use-debounce';
import { useInfiniteObserver } from '@/demo/hooks/useInfiniteObserver';
import { JobberService } from '@/demo/service/jobber.service';
import { Toast } from '@capacitor/toast';
import FullPageLoader from '@/demo/components/FullPageLoader';

type JobberStatus = 'Y' | 'N';

interface Jobber {
    code: string;
    cmpcode: number;
    sitename: string;
    site_type: string;
    ext: JobberStatus;
    mobileNumber?: string;
    email?: string;
    siteadd?: string;
}

const Jobbers = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm] = useDebounce(searchTerm, 1000);
    const [jobbers, setJobbers] = useState<Jobber[]>([]);
    const [visible, setVisible] = useState(false);
    const [currentJobber, setCurrentJobber] = useState<Partial<Jobber>>({
        sitename: '',
        cmpcode: 3,
        ext: 'N',
        site_type: 'J',
        mobileNumber: '',
        email: '',
        siteadd: ''
    });
    const [isEditMode, setIsEditMode] = useState(false);
    const [paginatorInfo, setPaginatorInfo] = useState<any>(null);
    const [isMaximized, setIsMaximized] = useState(true);
    const [hasMorePages, setHasMorePages] = useState(true);
    const [listLoading, setListLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const observerTarget = useRef<HTMLDivElement>(null);

    const fetchJobbers = async (loadMore = false) => {
        try {
            if (loadMore) {
                setIsLoadingMore(true);
            } else if (!searchTerm) {
                setIsInitialLoading(true);
            }

            const { data, paginatorInfo } = await JobberService.getJobbers(5, loadMore ? page + 1 : 1, debouncedSearchTerm || undefined);

            setJobbers((prev) => (loadMore ? [...prev, ...data] : data));
            setPaginatorInfo(paginatorInfo);
            setHasMorePages(paginatorInfo.hasMorePages);
            if (loadMore) setPage((prev) => prev + 1);
        } catch (err) {
            console.error('Failed to fetch jobbers:', err);
            await Toast.show({
                text: 'Failed to fetch jobbers',
                duration: 'short',
                position: 'bottom'
            });
        } finally {
            setIsInitialLoading(false);
            setIsLoadingMore(false);
            setListLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchJobbers();
    }, [debouncedSearchTerm]);

    useInfiniteObserver({
        targetRef: observerTarget,
        hasMorePages,
        isLoading: isLoadingMore,
        onIntersect: () => {
            if (hasMorePages) {
                fetchJobbers(true);
            }
        },
        deps: [hasMorePages, searchTerm]
    });

    const showAddDialog = () => {
        setCurrentJobber({
            sitename: '',
            cmpcode: 3,
            ext: 'N',
            site_type: 'J',
            mobileNumber: '',
            email: '',
            siteadd: ''
        });
        setIsEditMode(false);
        setVisible(true);
    };

    const showEditDialog = (jobber: Jobber) => {
        setCurrentJobber({
            ...jobber,
            mobileNumber: jobber.mobileNumber || '',
            email: jobber.email || '',
            siteadd: jobber.siteadd || ''
        });
        setIsEditMode(true);
        setVisible(true);
    };

    const handleSave = async () => {
        if (!currentJobber.sitename) {
            await Toast.show({
                text: 'Jobber name is required',
                duration: 'short',
                position: 'bottom'
            });
            return;
        }

        setListLoading(true);
        try {
            if (isEditMode && currentJobber.code) {
                const payload = {
                    sitename: currentJobber.sitename,
                    ext: currentJobber.ext || 'N',
                    ...(currentJobber.mobileNumber && { mobileNumber: currentJobber.mobileNumber }),
                    ...(currentJobber.email && { email: currentJobber.email }),
                    ...(currentJobber.siteadd && { siteadd: currentJobber.siteadd })
                };

                await JobberService.updateJobber(currentJobber.code, payload);
                await Toast.show({
                    text: 'Jobber updated successfully',
                    duration: 'short',
                    position: 'bottom'
                });
            } else {
                const payload = {
                    sitename: currentJobber.sitename,
                    cmpcode: 3,
                    site_type: 'J',
                    ext: currentJobber.ext || 'N',
                    ...(currentJobber.mobileNumber && { mobileNumber: currentJobber.mobileNumber }),
                    ...(currentJobber.email && { email: currentJobber.email }),
                    ...(currentJobber.siteadd && { siteadd: currentJobber.siteadd })
                };

                await JobberService.createJobber(payload);
                await Toast.show({
                    text: 'Jobber created successfully',
                    duration: 'short',
                    position: 'bottom'
                });
            }

            setVisible(false);
            fetchJobbers();
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to save jobber';
            await Toast.show({
                text: errorMessage,
                duration: 'short',
                position: 'bottom'
            });
            console.error('Error:', err);
        } finally {
            setListLoading(false);
        }
    };

    const confirmStatusChange = async (jobberCode: string, currentStatus: JobberStatus) => {
        const newStatus = currentStatus === 'N' ? 'Y' : 'N';

        confirmDialog({
            message: `Are you sure you want to ${newStatus === 'N' ? 'activate' : 'deactivate'} this jobber?`,
            header: 'Confirm Status Change',
            icon: 'pi pi-info-circle',
            accept: async () => {
                try {
                    setListLoading(true);
                    await JobberService.updateJobber(jobberCode, { ext: newStatus });
                    await Toast.show({
                        text: `Jobber ${newStatus === 'N' ? 'activated' : 'deactivated'} successfully`,
                        duration: 'short',
                        position: 'bottom'
                    });
                    fetchJobbers();
                } catch (err: any) {
                    const errorMessage = err?.message || 'Failed to update jobber status';
                    await Toast.show({
                        text: errorMessage,
                        duration: 'short',
                        position: 'bottom'
                    });
                    console.error('Error:', err);
                } finally {
                    setListLoading(false);
                }
            }
        });
    };

    if (isInitialLoading) {
        return (
            <div className="flex flex-column p-3 lg:p-0" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3 w-full">
                    <Skeleton width="10rem" height="1.5rem" />
                    <Skeleton width="100%" height="2rem" className="md:w-20rem" />
                    <Skeleton width="100%" height="2rem" />
                </div>

                <div className="flex flex-wrap gap-3 justify-content-start">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i} className="flex flex-column w-full sm:w-20rem lg:w-22rem">
                            <div className="flex justify-content-between align-items-start mb-3">
                                <div>
                                    <Skeleton width="12rem" height="1.75rem" className="mb-1" />
                                </div>
                                <Skeleton width="5rem" height="1.5rem" borderRadius="1rem" />
                            </div>

                            <div className="flex flex-column gap-2 mb-3">
                                <div className="flex align-items-center gap-2">
                                    <Skeleton width="10rem" height="1rem" />
                                </div>
                                <div className="flex align-items-center gap-2">
                                    <Skeleton width="10rem" height="1rem" />
                                </div>
                                <div className="flex align-items-start gap-2">
                                    <Skeleton width="10rem" height="1rem" />
                                </div>
                            </div>

                            <div className="flex justify-content-end gap-1">
                                <Skeleton shape="circle" size="2rem" />
                                <Skeleton shape="circle" size="2rem" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            {listLoading && <FullPageLoader />}
            <div className="flex flex-column p-3 lg:p-0" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <ConfirmDialog />

                <div className="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center mb-4 gap-3">
                    <h2 className="text-2xl m-0">Jobbers</h2>
                    <span className="p-input-icon-left p-input-icon-right w-full">
                        <i className="pi pi-search" />
                        <InputText value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search" className="w-full" />

                        {listLoading && debouncedSearchTerm ? (
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
                    <Button label="Add Jobber" icon="pi pi-plus" onClick={showAddDialog} className="w-full md:w-auto" size="small" />
                </div>

                <div className="flex flex-wrap gap-3 justify-content-start">
                    {jobbers.length > 0 ? (
                        <>
                            {jobbers.map((jobber) => (
                                <Card key={jobber.code} className="flex flex-column w-full sm:w-20rem lg:w-22rem transition-all transition-duration-200 hover:shadow-4">
                                    <div className="flex justify-content-between align-items-start mb-3">
                                        <div>
                                            <h3 className="text-xl m-0">{jobber.sitename || 'Unnamed Jobber'}</h3>
                                        </div>
                                        <Tag value={jobber.ext === 'N' ? 'Active' : 'Inactive'} severity={jobber.ext === 'N' ? 'success' : 'danger'} className="align-self-start" />
                                    </div>

                                    <div className="flex flex-column gap-2 mb-3">
                                        <div className="flex align-items-center gap-2">
                                            <i className="pi pi-phone text-sm" />
                                            <span className="text-sm">Mobile: {jobber.mobileNumber || 'Not Available'}</span>
                                        </div>
                                        <div className="flex align-items-center gap-2">
                                            <i className="pi pi-envelope text-sm" />
                                            <span className="text-sm">Email: {jobber.email || 'Not Available'}</span>
                                        </div>
                                        <div className="flex align-items-start gap-2">
                                            <i className="pi pi-map-marker text-sm mt-1" />
                                            <span className="text-sm">Address: {jobber.siteadd || 'Not Available'}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-content-end gap-1">
                                        <Button icon="pi pi-pencil" rounded text onClick={() => showEditDialog(jobber)} severity="secondary" tooltip="Edit jobber" tooltipOptions={{ position: 'top' }} />
                                        <Button
                                            icon={jobber.ext === 'N' ? 'pi pi-trash' : 'pi pi-replay'}
                                            rounded
                                            text
                                            severity={jobber.ext === 'N' ? 'danger' : 'success'}
                                            onClick={() => confirmStatusChange(jobber.code, jobber.ext)}
                                            tooltip={jobber.ext === 'N' ? 'Deactivate' : 'Activate'}
                                            tooltipOptions={{ position: 'top' }}
                                        />
                                    </div>
                                </Card>
                            ))}
                            <div ref={observerTarget} className="w-full flex justify-content-center p-3">
                                {isLoadingMore && (
                                    <div className="flex align-items-center gap-2">
                                        <i className="pi pi-spinner pi-spin" />
                                        <span>Loading more jobbers...</span>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="w-full p-4 text-center surface-100 border-round">
                            <i className="pi pi-search text-3xl mb-2" />
                            <h4>No jobbers found</h4>
                            {searchTerm && <Button label="Clear search" className="mt-3" onClick={() => setSearchTerm('')} size="small" />}
                        </div>
                    )}
                </div>

                <Dialog
                    header={isEditMode ? 'Edit Jobber' : 'Add New Jobber'}
                    visible={visible}
                    onHide={() => setVisible(false)}
                    maximized={isMaximized}
                    onMaximize={(e) => setIsMaximized(e.maximized)}
                    className={isMaximized ? 'maximized-dialog' : ''}
                    blockScroll
                    footer={
                        <div>
                            <Button label="Cancel" icon="pi pi-times" onClick={() => setVisible(false)} className="p-button-text" />
                            <Button label="Save" icon="pi pi-check" onClick={handleSave} disabled={!currentJobber.sitename} />
                        </div>
                    }
                >
                    {currentJobber && (
                        <div className="p-fluid grid my-3">
                            <div className="field col-12">
                                <label htmlFor="sitename">Jobber Name*</label>
                                <InputText id="sitename" value={currentJobber.sitename || ''} onChange={(e) => setCurrentJobber({ ...currentJobber, sitename: e.target.value })} required />
                            </div>
                            <div className="field col-12">
                                <label htmlFor="mobile">Mobile</label>
                                <InputText id="mobile" type="tel" inputMode="numeric" value={currentJobber.mobileNumber || ''} onChange={(e) => setCurrentJobber({ ...currentJobber, mobileNumber: e.target.value })} />
                            </div>
                            <div className="field col-12">
                                <label htmlFor="email">Email</label>
                                <InputText id="email" value={currentJobber.email || ''} onChange={(e) => setCurrentJobber({ ...currentJobber, email: e.target.value })} />
                            </div>
                            <div className="field col-12">
                                <label htmlFor="address">Address</label>
                                <InputText id="address" value={currentJobber.siteadd || ''} onChange={(e) => setCurrentJobber({ ...currentJobber, siteadd: e.target.value })} />
                            </div>
                            <div className="field col-12 md:col-6">
                                <label htmlFor="status">Status</label>
                                <ToggleButton
                                    id="status"
                                    onLabel="Active"
                                    offLabel="Inactive"
                                    onIcon="pi pi-check"
                                    offIcon="pi pi-times"
                                    checked={currentJobber.ext === 'N'}
                                    onChange={(e) =>
                                        setCurrentJobber({
                                            ...currentJobber,
                                            ext: e.value ? 'N' : 'Y'
                                        })
                                    }
                                    className="w-full md:w-10rem"
                                />
                            </div>
                        </div>
                    )}
                </Dialog>
            </div>
        </>
    );
};

export default Jobbers;
