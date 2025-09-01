import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import { Application } from '@/models/Application'

// Environment variables for Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_SUPPORT_CHAT_ID

interface ApplicationData {
  // Personal Information
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  country: string
  city: string
  
  // Project Information
  projectTitle: string
  projectDescription: string
  projectField: string
  targetAudience: string
  
  // Grant Details
  requestedAmount: string
  projectDuration: string
  fundingUse: string
  expectedImpact: string
  
  // Additional Information
  previousExperience: string
  whyDeserving: string
}

async function sendTelegramNotification(applicationData: ApplicationData & { applicationId: string }) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram configuration missing, skipping notification')
    return
  }

  const baseUrl = process.env.NODE_ENV === 'production' 
    ? process.env.NEXTAUTH_URL || 'https://your-domain.com'
    : 'http://localhost:3000'

  const message = `
🆕 *NEW GRANT APPLICATION SUBMITTED*

👤 *Applicant:* ${applicationData.firstName} ${applicationData.lastName}
📧 *Email:* ${applicationData.email}
📞 *Phone:* ${applicationData.phone}
🌍 *Location:* ${applicationData.city}, ${applicationData.country}

🎯 *Project:* ${applicationData.projectTitle}
💰 *Amount Requested:* $${applicationData.requestedAmount}
⏱️ *Duration:* ${applicationData.projectDuration}
🏷️ *Field:* ${applicationData.projectField}

📝 *Project Description:*
${applicationData.projectDescription.substring(0, 200)}${applicationData.projectDescription.length > 200 ? '...' : ''}

🎯 *Target Audience:*
${applicationData.targetAudience.substring(0, 150)}${applicationData.targetAudience.length > 150 ? '...' : ''}

💡 *Expected Impact:*
${applicationData.expectedImpact.substring(0, 200)}${applicationData.expectedImpact.length > 200 ? '...' : ''}

🆔 *Application ID:* \`${applicationData.applicationId}\`
🕐 *Submitted:* ${new Date().toLocaleString()}

---
[View All Applications](${baseUrl}/admin/applications)
`

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }),
    })

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`)
    }

    console.log('Telegram notification sent for application:', applicationData.applicationId)
  } catch (error) {
    console.error('Failed to send Telegram notification for application:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    // Ensure connection is ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve)
      })
    }

    const applicationData: ApplicationData = await request.json()
    
    // Generate unique application ID
    const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    // Create new application
    const application = new Application({
      ...applicationData,
      applicationId
    })

    await application.save()

    // Send Telegram notification
    await sendTelegramNotification({
      ...applicationData,
      applicationId
    })

    console.log('Grant application submitted successfully:', applicationId)

    return NextResponse.json({ 
      success: true, 
      message: 'Application submitted successfully',
      applicationId
    })

  } catch (error) {
    console.error('Error processing application:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to submit application. Please try again.' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    // Ensure connection is ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve)
      })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    const query: any = {}
    if (status) query.status = status

    const applications = await Application.find(query)
      .sort({ submittedAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({ 
      success: true, 
      applications 
    })

  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch applications' 
      },
      { status: 500 }
    )
  }
}
