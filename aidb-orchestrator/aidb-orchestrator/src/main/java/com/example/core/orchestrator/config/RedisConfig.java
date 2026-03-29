/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package com.example.core.orchestrator.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.context.annotation.Bean;
import com.example.messaging.MessageConsumer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        // Anahtarları (Key) düz metin olarak sakla
        template.setKeySerializer(new StringRedisSerializer());
        
        // Objeleri (Value) JSON formatında sakla (Böylece Python rahat okur)
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        return template;
    }
    
    @Bean
RedisMessageListenerContainer container(RedisConnectionFactory connectionFactory, 
                                        MessageConsumer receiver) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    // 'aidb_response_queue' kanalını dinle
    container.addMessageListener(receiver, new PatternTopic("aidb_response_queue"));
    return container;
}
    
}
