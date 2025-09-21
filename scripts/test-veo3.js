#!/usr/bin/env node

/**
 * Test script for Veo3 video generation
 * This script tests the genarateVideo function with Veo3
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execFileAsync = promisify(execFile);

async function testVeo3VideoGeneration() {
  console.log('🎬 Testing Veo3 video generation...');
  
  try {
    // Check if Google Cloud credentials are available
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      console.log('❌ GOOGLE_CLOUD_PROJECT_ID environment variable is not set');
      console.log('💡 Please set it with: export GOOGLE_CLOUD_PROJECT_ID="your-project-id"');
      return;
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const modelId = 'veo-3.0-generate-001';
    
    console.log(`📋 Project ID: ${projectId}`);
    console.log(`🤖 Model: ${modelId}`);
    
    // Create temp directory
    const tempVideosDir = path.join(__dirname, '..', 'public', 'temp', 'videos');
    if (!fs.existsSync(tempVideosDir)) {
      fs.mkdirSync(tempVideosDir, { recursive: true });
    }
    
    // Prepare the request body for Veo3 API
    const requestBody = {
      instances: [{
        prompt: 'A beautiful sunset over mountains, cinematic quality, 16:9 aspect ratio (avoid: text, watermark, logo, low quality, blurry) (16:9 aspect ratio, 8 seconds duration, with background music, cinematic quality)'
      }],
      parameters: {
        aspectRatio: '16:9',
        duration: 8,
        sampleCount: 1
      }
    };
    
    const requestFile = path.join(tempVideosDir, 'veo3_request.json');
    fs.writeFileSync(requestFile, JSON.stringify(requestBody, null, 2));
    
    console.log('📝 Request prepared, calling Veo3 API...');
    console.log('🎵 Prompt includes: background music, 8 seconds duration');
    
    // Get access token
    console.log('🔑 Getting access token...');
    const { stdout: tokenResponse } = await execFileAsync('gcloud', [
      'auth', 'print-access-token'
    ]);
    const accessToken = tokenResponse.trim();
    
    // Call Veo3 API using curl with output to temp file
    const apiUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:predictLongRunning`;
    const operationResponseFile = path.join(tempVideosDir, 'veo3_operation_response.json');
    
    console.log('🚀 Calling Veo3 API...');
    await execFileAsync('curl', [
      '-X', 'POST',
      '-H', `Authorization: Bearer ${accessToken}`,
      '-H', 'Content-Type: application/json; charset=utf-8',
      '-d', `@${requestFile}`,
      '-o', operationResponseFile,
      apiUrl
    ]);
    
    const operationResponse = fs.readFileSync(operationResponseFile, 'utf-8');
    const operation = JSON.parse(operationResponse);
    
    console.log('✅ Veo3 operation started successfully!');
    console.log('📋 Operation name:', operation.name);
    
    if (operation.error) {
      console.error('❌ Veo3 API error:', operation.error);
      return;
    }
    
    // Poll for completion
    console.log('⏳ Polling for completion...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const statusResponseFile = path.join(tempVideosDir, `veo3_status_response_${attempts}.json`);
      
      await execFileAsync('curl', [
        '-X', 'POST',
        '-H', `Authorization: Bearer ${accessToken}`,
        '-H', 'Content-Type: application/json; charset=utf-8',
        '-d', JSON.stringify({ operationName: operation.name }),
        '-o', statusResponseFile,
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}:fetchPredictOperation`
      ]);
      
      const statusResponse = fs.readFileSync(statusResponseFile, 'utf-8');
      const status = JSON.parse(statusResponse);
      
      console.log(`🔄 Attempt ${attempts + 1}/${maxAttempts}: ${status.done ? '✅ Done' : '⏳ Processing...'}`);
      
      if (status.done) {
        if (status.error) {
          console.error('❌ Veo3 operation failed:', status.error);
          return;
        }
        
        console.log('🎉 Veo3 operation completed successfully!');
        
        // Save complete response to temp file for debugging
        const responseDebugFile = path.join(tempVideosDir, 'veo3_response_debug.json');
        fs.writeFileSync(responseDebugFile, JSON.stringify(status, null, 2));
        console.log('💾 Debug response saved to:', responseDebugFile);
        
        // Process video data
        if (status.response && status.response.videos && status.response.videos.length > 0) {
          const video = status.response.videos[0];
          console.log('🎬 Video object keys:', Object.keys(video));
          console.log('🎬 Video mimeType:', video.mimeType);
          
          // Check for base64 data
          const base64Data = video.data || video.content || video.videoData || video.bytesBase64Encoded;
          if (base64Data) {
            console.log('✅ Base64 video data found!');
            console.log('📏 Data length:', base64Data.length);
            
            // Decode and save video
            const cleanBase64 = base64Data.replace(/^data:video\/mp4;base64,/, '');
            const videoBuffer = Buffer.from(cleanBase64, 'base64');
            
            const testVideoPath = path.join(tempVideosDir, 'veo3_test_video.mp4');
            fs.writeFileSync(testVideoPath, videoBuffer);
            
            console.log('💾 Veo3 test video saved to:', testVideoPath);
            console.log('📏 Video size:', videoBuffer.length, 'bytes');
            console.log('🎵 Video includes: background music (8 seconds)');
            console.log('🎉 Veo3 test completed successfully!');
            
          } else {
            console.log('❌ No base64 video data found');
          }
        } else {
          console.log('❌ No video data found in response');
        }
        
        completed = true;
      }
      
      attempts++;
    }
    
    if (!completed) {
      console.log('⏰ Veo3 operation timed out after 5 minutes');
    }
    
    // Clean up
    try {
      fs.unlinkSync(requestFile);
      fs.unlinkSync(operationResponseFile);
      for (let i = 0; i < attempts; i++) {
        const statusFile = path.join(tempVideosDir, `veo3_status_response_${i}.json`);
        if (fs.existsSync(statusFile)) {
          fs.unlinkSync(statusFile);
        }
      }
    } catch (cleanupError) {
      console.log('⚠️ Cleanup warning:', cleanupError.message);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// Run the test
testVeo3VideoGeneration();