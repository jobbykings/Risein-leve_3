"use client";

interface TransactionAlertProps {
  status: "success" | "failure" | null;
  hash: string | null;
  error: string | null;
  explorerUrl: string | null;
  onDismiss: () => void;
}

export default function TransactionAlert({
  status,
  hash,
  error,
  explorerUrl,
  onDismiss,
}: TransactionAlertProps) {
  if (!status) return null;

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm ${
        status === "success"
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {status === "success" ? (
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div>
            {status === "success" ? (
              <div>
                <p className="text-sm font-medium text-green-800">Contribution recorded on-chain!</p>
                {explorerUrl && hash && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all font-mono text-sm text-green-600 underline hover:text-green-800"
                  >
                    {hash}
                  </a>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-red-800">Transaction Failed</p>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>
        <button onClick={onDismiss} className="ml-4 text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
