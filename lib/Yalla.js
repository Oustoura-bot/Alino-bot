import axios from 'axios';
import cheerio from 'cheerio';

export async function getMatchesData(date = '5/23/2025') {
  try {
    const response = await axios.get(`https://www.yallakora.com/match-center/%D9%85%D8%B1%D9%83%D8%B2-%D8%A7%D9%84%D9%85%D8%A8%D8%A7%D8%B1%D9%8A%D8%A7%D8%AA?date=${date}#days`);
    const $ = cheerio.load(response.data);
    const tournaments = [];

    $('.matchCard.matchesList').each((index, el) => {
      const tournament = {
        name: $(el).find('.tourTitle h2').text().trim(),
        matches: []
      };

      $(el).find('.ul .item').each((i, matchEl) => {
        const linkSuffix = $(matchEl).find('a').attr('href') || '';
        const match = {
          teamA: $(matchEl).find('.teams.teamA p').text().trim(),
          logoA: $(matchEl).find('.teams.teamA img').attr('src'),
          teamB: $(matchEl).find('.teams.teamB p').text().trim(),
          logoB: $(matchEl).find('.teams.teamB img').attr('src'),
          time: $(matchEl).find('.MResult .time').text().trim(),
          status: $(matchEl).find('.matchStatus span').text().trim(),
          channel: $(matchEl).find('.channel.icon-channel').text().trim() || $(matchEl).find('.channel').text().trim(),
          round: $(matchEl).find('.topData .date').text().trim(),
          scoreA: $(matchEl).find('.MResult .score').first().text().trim(),
          scoreB: $(matchEl).find('.MResult .score').last().text().trim(),
          link: linkSuffix.startsWith('http') ? linkSuffix : `https://www.yallakora.com${linkSuffix}`
        };

        tournament.matches.push(match);
      });

      tournaments.push(tournament);
    });

    return tournaments;

  } catch (e) {
    console.log("خطأ في جلب البيانات:", e);
    return [];
  }
}