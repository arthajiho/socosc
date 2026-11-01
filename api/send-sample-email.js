/**
 * Vercel Serverless Function / Node.js API
 * 원료 샘플 및 자료 요청 시 네이버 SMTP를 통해 관리자(socsoc_contact@naver.com)에게 실시간 알림 이메일 전송
 */

const fs = require('fs');
const path = require('path');

// 1. .env.local 자동 로드 (로컬 개발 및 Vercel 환경 모두 지원)
function loadEnvLocal() {
  if (process.env.NAVER_EMAIL_USER && process.env.NAVER_EMAIL_PASS) return;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn('[SOCSOC] .env.local 로드 경고:', err);
  }
}

// 2. HTML 이메일 템플릿 생성기 (기본자료 / 견적서 / 샘플 선택 여부 직관적 시각화)
function generateSampleEmailHtml(data) {
  const ingredientName = data.ingredient_name || data.ingredientName || '원료명 미기재';
  const requesterName = data.requester_name || data.requesterName || '신청자 미기재';
  const companyName = data.company_name || data.companyName || '미기재 (개인/연구원)';
  const contactPhone = data.contact_phone || data.contactPhone || '연락처 미기재';
  const contactEmail = data.contact_email || data.contactEmail || '이메일 미기재';
  const shippingAddress = data.shipping_address || data.shippingAddress || '주소 미기재';
  const notes = data.notes ? String(data.notes).replace(/\n/g, '<br>') : '없음';

  // 요청 항목 추출 (배열, 쉼표 구분 문자열 등 다중 포맷 호환)
  let rawItems = [];
  if (Array.isArray(data.request_items)) {
    rawItems = data.request_items;
  } else if (Array.isArray(data.requestItems)) {
    rawItems = data.requestItems;
  } else if (typeof data.request_items === 'string') {
    rawItems = data.request_items.split(',').map(s => s.trim()).filter(Boolean);
  } else if (data.request_type) {
    rawItems = String(data.request_type).split(',').map(s => s.trim()).filter(Boolean);
  }

  const isDataSelected = rawItems.some(i => i.includes('기본자료') || i.includes('자료'));
  const isQuoteSelected = rawItems.some(i => i.includes('견적서') || i.includes('견적'));
  const isSampleSelected = rawItems.some(i => i.includes('샘플'));

  const selectedList = [];
  if (isDataSelected) selectedList.push('기본자료');
  if (isQuoteSelected) selectedList.push('견적서');
  if (isSampleSelected) selectedList.push('샘플');
  const requestItemsSummary = selectedList.length > 0 ? selectedList.join(' · ') : '원료 요청';

  // 한국 시간(KST) 접수 일시 포맷팅
  const now = new Date();
  const kstDateStr = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);

  const subject = `[속속 알림] [${requestItemsSummary}] ${ingredientName} (${requesterName}님 요청)`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 33, 55, 0.08); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- 헤더 영역 -->
          <tr>
            <td style="background-color: #0f2137; padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: #6366f1; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">SOCSOC RAW MATERIAL REQUEST</span>
                    <h1 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 10px 0 4px 0; line-height: 1.3;">[속속 알림] 새로운 원료 요청 접수</h1>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0;">원료 분석기에서 회원님의 샘플 및 자료 요청이 접수되었습니다.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 원료 하이라이트 배너 -->
          <tr>
            <td style="padding: 24px 32px 10px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
                <span style="display: block; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">신청 대상 원료명</span>
                <div style="font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1.3;">
                  ${ingredientName}
                </div>
              </div>
            </td>
          </tr>

          <!-- 요청 항목 상태 카드 섹션 (기본자료 / 견적서 / 샘플 한눈에 확인) -->
          <tr>
            <td style="padding: 6px 32px 14px 32px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 16px 14px 16px;">
                <div style="font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 12px;">
                  📋 <strong>요청 항목 확인</strong> <span style="font-size: 11px; color: #64748b; font-weight: 500;">(신청된 항목이 강조 표시됩니다)</span>
                </div>
                <table role="presentation" width="100%" cellspacing="8" cellpadding="0" style="margin: 0;">
                  <tr>
                    <!-- 기본자료 -->
                    <td width="33.3%" align="center" style="padding: 14px 8px; border-radius: 10px; ${isDataSelected ? 'background-color: #ecfdf5; border: 2px solid #10b981;' : 'background-color: #ffffff; border: 1px dashed #cbd5e1; opacity: 0.55;'}">
                      <div style="font-size: 22px; margin-bottom: 4px; line-height: 1;">${isDataSelected ? '✅' : '⚪'}</div>
                      <div style="font-size: 14px; font-weight: 900; color: ${isDataSelected ? '#065f46' : '#94a3b8'};">기본자료</div>
                      <div style="display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 9999px; ${isDataSelected ? 'background-color: #10b981; color: #ffffff;' : 'background-color: #e2e8f0; color: #64748b;'}">
                        ${isDataSelected ? '요청 완료' : '미요청'}
                      </div>
                    </td>
                    <!-- 견적서 -->
                    <td width="33.3%" align="center" style="padding: 14px 8px; border-radius: 10px; ${isQuoteSelected ? 'background-color: #eff6ff; border: 2px solid #3b82f6;' : 'background-color: #ffffff; border: 1px dashed #cbd5e1; opacity: 0.55;'}">
                      <div style="font-size: 22px; margin-bottom: 4px; line-height: 1;">${isQuoteSelected ? '✅' : '⚪'}</div>
                      <div style="font-size: 14px; font-weight: 900; color: ${isQuoteSelected ? '#1e40af' : '#94a3b8'};">견적서</div>
                      <div style="display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 9999px; ${isQuoteSelected ? 'background-color: #3b82f6; color: #ffffff;' : 'background-color: #e2e8f0; color: #64748b;'}">
                        ${isQuoteSelected ? '요청 완료' : '미요청'}
                      </div>
                    </td>
                    <!-- 샘플 -->
                    <td width="33.3%" align="center" style="padding: 14px 8px; border-radius: 10px; ${isSampleSelected ? 'background-color: #faf5ff; border: 2px solid #a855f7;' : 'background-color: #ffffff; border: 1px dashed #cbd5e1; opacity: 0.55;'}">
                      <div style="font-size: 22px; margin-bottom: 4px; line-height: 1;">${isSampleSelected ? '✅' : '⚪'}</div>
                      <div style="font-size: 14px; font-weight: 900; color: ${isSampleSelected ? '#6b21a8' : '#94a3b8'};">샘플</div>
                      <div style="display: inline-block; margin-top: 6px; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 9999px; ${isSampleSelected ? 'background-color: #a855f7; color: #ffffff;' : 'background-color: #e2e8f0; color: #64748b;'}">
                        ${isSampleSelected ? '요청 완료' : '미요청'}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- 상세 정보 테이블 -->
          <tr>
            <td style="padding: 6px 32px 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 13px; color: #334155;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b; width: 110px;">요청자 성함</td>
                  <td style="padding: 12px 8px; font-weight: 800; color: #0f172a;">${requesterName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b;">소속 (회사명)</td>
                  <td style="padding: 12px 8px; font-weight: 700; color: #0f172a;">${companyName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b;">연락처</td>
                  <td style="padding: 12px 8px; font-weight: 700; color: #2563eb;">
                    <a href="tel:${contactPhone}" style="color: #2563eb; text-decoration: none;">${contactPhone}</a>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b;">이메일 주소</td>
                  <td style="padding: 12px 8px; font-weight: 700; color: #4f46e5;">
                    <a href="mailto:${contactEmail}" style="color: #4f46e5; text-decoration: none;">${contactEmail}</a>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b; vertical-align: top;">샘플 수령지</td>
                  <td style="padding: 12px 8px; font-weight: 600; line-height: 1.5; color: #1e293b;">${shippingAddress}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b; vertical-align: top;">기타 요청사항</td>
                  <td style="padding: 12px 8px; font-weight: 500; line-height: 1.5; color: #334155; background-color: #f8fafc; border-radius: 8px;">${notes}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 8px; font-weight: 700; color: #64748b;">접수 일시</td>
                  <td style="padding: 12px 8px; font-weight: 600; color: #64748b;">${kstDateStr} (KST)</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 하단 안내 및 푸터 -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.6;">
                본 메일은 속속(thesocsoc.com) 제형 개발 플랫폼 시스템에서 자동 발송되었습니다.<br>
                Supabase 관리자 콘솔 Table Editor의 <strong>sample_requests</strong> 테이블에서도 실시간 확인이 가능합니다.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { html, subject };
}

// 3. Vercel Serverless Function / Node API 핸들러
module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // .env.local 로드
  loadEnvLocal();

  const naverUser = (process.env.NAVER_EMAIL_USER || '').trim();
  const naverPass = (process.env.NAVER_EMAIL_PASS || '').trim();

  if (!naverUser || !naverPass) {
    console.error('[SOCSOC] NAVER_EMAIL_USER 또는 NAVER_EMAIL_PASS 환경변수가 누락되었습니다.');
    return res.status(500).json({
      success: false,
      error: '이메일 발송 인증 설정(NAVER_EMAIL_USER, NAVER_EMAIL_PASS)이 구성되지 않았습니다.'
    });
  }

  // 발송자 및 수신자 네이버 이메일 주소 구성
  const senderEmail = naverUser.includes('@') ? naverUser : `${naverUser}@naver.com`;
  const receiverEmail = senderEmail;

  // 요청 본문 파싱 (문자열 또는 객체 대응)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  body = body || {};

  try {
    // nodemailer 모듈 동적 로드 (모듈 미설치 시 명확한 에러 안내)
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      console.error('[SOCSOC] nodemailer 모듈이 설치되어 있지 않습니다. npm install nodemailer 를 실행해주세요.');
      return res.status(500).json({
        success: false,
        error: '서버에 nodemailer 모듈이 설치되어 있지 않습니다. 터미널에서 npm install nodemailer 를 실행해주세요.'
      });
    }

    // SMTP 전송 객체 구성 (네이버 메일 SMTP 설정: smtp.naver.com / 포트 465 / SSL)
    const transporter = nodemailer.createTransport({
      host: 'smtp.naver.com',
      port: 465,
      secure: true, // SSL 보안 연결
      auth: {
        user: naverUser,
        pass: naverPass
      }
    });

    const emailResult = generateSampleEmailHtml(body);

    const mailOptions = {
      from: `"속속 샘플알리미" <${senderEmail}>`,
      to: receiverEmail,
      subject: emailResult.subject,
      html: emailResult.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[SOCSOC] 네이버 이메일 알림 발송 성공:', info.messageId);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: '네이버 메일 알림이 성공적으로 전송되었습니다.'
    });
  } catch (err) {
    console.error('[SOCSOC] 네이버 이메일 발송 오류:', err);
    return res.status(500).json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다: ' + err.message
    });
  }
};
