import React, { useState } from 'react';

import { AlertTriangle, X } from 'lucide-react';

import { useDeleteAccount } from '@/queries/auth/authQueries';
import { toast } from '@/utils/toastManager';


import { Button } from './ui/button';
import { Input } from './ui/input';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ isOpen, onClose }) => {
    const [confirmText, setConfirmText] = useState('');

    const deleteAccountMutation = useDeleteAccount({
        onSuccess: () => {
            // пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ mutation
        },
    });

    const isDeleting = deleteAccountMutation.isPending;

    const handleDelete = () => {
        if (confirmText !== 'Delete') {
            toast.error('пїЅпїЅпїЅпїЅпїЅпїЅпїЅ "Delete" пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ');
            return;
        }

        deleteAccountMutation.mutate();
    };

    const handleClose = () => {
        if (!isDeleting) {
            setConfirmText('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                        <h2 className="text-xl font-bold text-white">
                            пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
                        </h2>
                    </div>
                    {!isDeleting && (
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <p className="text-red-400 font-semibold mb-2">
                            [WARN] пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ!
                        </p>
                        <p className="text-gray-300 text-sm">
                            пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ:
                        </p>
                        <ul className="list-disc list-inside text-gray-400 text-sm mt-2 space-y-1">
                            <li>пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ (Twitch, VK Live)</li>
                            <li>пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ TTS пїЅ пїЅпїЅпїЅпїЅ</li>
                            <li>пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ</li>
                            <li>пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ OBS пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ</li>
                            <li>пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ</li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            пїЅпїЅпїЅпїЅпїЅпїЅпїЅ <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-red-400">Delete</span> пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ:
                        </label>
                        <Input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Delete"
                            disabled={isDeleting}
                            className="bg-gray-700 border-gray-600 text-white"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isDeleting}
                    >
                        пїЅпїЅпїЅпїЅпїЅпїЅ
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={confirmText !== 'Delete' || isDeleting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isDeleting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ...
                            </>
                        ) : (
                            'пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountModal;

