package com.example.core.orchestrator.config;

import com.example.auth.AuthTokenFilter;
import com.example.auth.UserDetailsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import javax.servlet.http.HttpServletResponse;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Override
    public void configure(AuthenticationManagerBuilder authenticationManagerBuilder) throws Exception {
        authenticationManagerBuilder
                .userDetailsService(userDetailsService)
                .passwordEncoder(passwordEncoder());
    }

    @Bean
    @Override
    public AuthenticationManager authenticationManagerBean() throws Exception {
        return super.authenticationManagerBean();
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.cors().and().csrf().disable()
            .exceptionHandling().authenticationEntryPoint((request, response, authException) -> {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Hata: Yetkisiz Erişim. Lütfen giriş yapın.");
            }).and()
            .sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS).and()
            .authorizeRequests()
            // 1. Giriş ve Kayıt yolları açık
            .antMatchers("/api/v1/auth/**").permitAll()
            
            // 2. KRİTİK: SSE (Server-Sent Events) abonelik yolunu herkese açıyoruz.
            // Tarayıcı EventSource isteğine Header ekleyemediği için burayı permitAll yapmazsak 
            // bağlantı kurulamaz ve "Zaman Aşımı" hatası alırsın.
            .antMatchers("/api/sse/subscribe/**").permitAll()
            
            // 3. H2-Console kullanımı için
            .antMatchers("/h2-console/**").permitAll()
            
            // OPTIONS isteklerine (CORS için) izin ver
            .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            
            // Geri kalan tüm API'lar (Query, History, DB Connect vb.) kilitli!
            .anyRequest().authenticated();

        http.headers().frameOptions().sameOrigin();

        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);
    }
}