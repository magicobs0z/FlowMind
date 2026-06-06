import { useState, useEffect, useRef } from 'react'

export function useTypewriter(text: string, speed: number = 20) {
  const [displayedText, setDisplayedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!text) {
      setDisplayedText('')
      return
    }

    setIsTyping(true)
    indexRef.current = 0
    setDisplayedText('')

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        setIsTyping(false)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return { displayedText, isTyping }
}

export function useStreamingContent(initialContent: string = '') {
  const [content, setContent] = useState(initialContent)
  const [displayedContent, setDisplayedContent] = useState(initialContent)
  const [isStreaming, setIsStreaming] = useState(false)
  const indexRef = useRef(initialContent.length)

  const appendContent = (chunk: string) => {
    setContent(prev => prev + chunk)
    setIsStreaming(true)
    indexRef.current += chunk.length
  }

  const finishStreaming = () => {
    setIsStreaming(false)
    setDisplayedContent(content)
  }

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content)
      return
    }

    const interval = setInterval(() => {
      if (indexRef.current < content.length) {
        setDisplayedContent(content.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        setIsStreaming(false)
        clearInterval(interval)
      }
    }, 20)

    return () => clearInterval(interval)
  }, [content, isStreaming])

  return {
    content,
    displayedContent,
    isStreaming,
    appendContent,
    finishStreaming
  }
}
