import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { FileText, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const documentInputRef = useRef(null);
  const { sendMessage, sendDocument } = useChatStore();

  const handleDocumentChange = (e) => {
    const file = e.target.files[0];
    setDocumentFile(file); // Store file for sending
  };

  const removeDocument = () => {
    setDocumentFile(null);
    if (documentInputRef.current) documentInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !documentFile) return;

    try {
      // Send document if present
      if (documentFile) {
        await sendDocument(documentFile);
        setDocumentFile(null);
        if (documentInputRef.current) documentInputRef.current.value = "";
      }

      // Send text if present (and no document)
      if (text.trim() && !documentFile) {
        await sendMessage({ text: text.trim() });
        setText("");
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="p-4 w-full">
      {documentFile && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <span className="text-sm">{documentFile.name}</span>
            <button
              onClick={removeDocument}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
            className="hidden"
            ref={documentInputRef}
            onChange={handleDocumentChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${
              documentFile ? "text-emerald-500" : "text-zinc-400"
            }`}
            onClick={() => documentInputRef.current?.click()}
          >
            <FileText size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !documentFile}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;