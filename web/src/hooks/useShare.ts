
type Response ={
    message?: string,
    type?: string
}

export default function useShare(title: string, text: string, url: string): Response{
    if (navigator.share) {
        navigator.share({
            title,
            text,
            url,
        })
            .then(() => {
                return {
                    message: 'Successfully shared', 
                    type: 'success'
                }
            })
            .catch((error) => {
                return {
                    message: error.message, 
                    type: "error"
                }
            });
    } else {
        return {
            message: 'Web Share API not supported in this browser, use copy and share.',
            type: 'error'
        }
    }
    return { }
}