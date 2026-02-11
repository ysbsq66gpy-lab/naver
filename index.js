require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const app = express();
const path = require('path');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

app.use(express.static('public'));

/**
 * Naver 블로그 검색 API
 */
async function searchNaverBlogs(query, display = 5) {
    try {
        const response = await axios.get(`https://openapi.naver.com/v1/search/blog.json`, {
            params: { query, display, sort: 'date' },
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
        });
        return response.data.items;
    } catch (error) {
        console.error('Naver Search API Failed:', error.message);
        return [];
    }
}

/**
 * 블로그 본문 수집
 */
async function fetchBlogContent(url) {
    try {
        const urlObj = new URL(url);
        let blogId, logNo;
        if (urlObj.hostname === 'blog.naver.com') {
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            blogId = pathParts[0];
            logNo = pathParts[1];
        }
        if (!blogId || !logNo) return null;

        const mobileUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
        const response = await axios.get(mobileUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);
        let content = $('.se-main-container').text().trim() || $('#post-view-' + logNo).text().trim() || $('.post_content').text().trim();
        return content;
    } catch (error) {
        return null;
    }
}

// API Endpoint
app.get('/api/search', async (req, res) => {
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
        return res.status(500).json({ error: 'Naver API keys are missing in environment variables.' });
    }

    const query = req.query.q || '네이버쇼핑 파트너 제안';
    const blogs = await searchNaverBlogs(query, 5);

    const results = [];
    for (const blog of blogs) {
        const content = await fetchBlogContent(blog.link);
        results.push({
            title: blog.title.replace(/<[^>]*>?/gm, ''),
            link: blog.link,
            postdate: blog.postdate,
            preview: content ? content.substring(0, 300) : '본문을 가져올 수 없습니다.'
        });
    }
    res.json(results);
});

// Vercel은 SPA가 아닐 경우 명시적인 핸들링이 필요할 수 있음
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel 배포를 위해 app을 export 합니다.
module.exports = app;

// 로컬 테스트를 위해 환경 변수가 없을 때만 listen 합니다.
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
