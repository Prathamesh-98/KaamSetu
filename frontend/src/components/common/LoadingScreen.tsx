// KaamSetu — Loading Screen
export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading KaamSetu...</p>
      </div>
    </div>
  )
}
